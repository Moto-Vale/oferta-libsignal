
'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const BaseKeyType = require('./base_key_type');
const ChainType = require('./chain_type');
const SessionRecord = require('./session_record');
const crypto = require('./crypto');
const curve = require('./curve');
const errors = require('./errors');
const queueJob = require('./queue_job');

// Worker persistente para operações CPU-bound de curva/crypto.
let _cryptoWorker = null;
const _cryptoPending = new Map();
let _cryptoReqId = 0;

function _getCryptoWorker() {
    if (!_cryptoWorker) {
        _cryptoWorker = new Worker(path.join(__dirname, 'crypto_worker.js'));
        _cryptoWorker.on('message', ({ id, result, error }) => {
            const pending = _cryptoPending.get(id);
            if (!pending) return;
            _cryptoPending.delete(id);
            if (error) pending.reject(new Error(error));
            else pending.resolve(result);
        });
        _cryptoWorker.on('error', err => {
            _cryptoWorker = null;
            for (const { reject } of _cryptoPending.values()) reject(err);
            _cryptoPending.clear();
        });
        _cryptoWorker.on('exit', () => { _cryptoWorker = null; });
    }
    return _cryptoWorker;
}

function _runInCryptoWorker(data) {
    return new Promise((resolve, reject) => {
        const id = ++_cryptoReqId;
        _cryptoPending.set(id, { resolve, reject });
        _getCryptoWorker().postMessage({ id, data });
    });
}

class SessionBuilder {

    constructor(storage, protocolAddress) {
        this.addr = protocolAddress;
        this.storage = storage;
    }

    async initOutgoing(device) {
        const fqAddr = this.addr.toString();
        return await queueJob(fqAddr, async () => {
            // Dispara isTrustedIdentity e getOurIdentity em paralelo para minimizar latência de I/O.
            const trustedPromise      = this.storage.isTrustedIdentity(this.addr.id, device.identityKey);
            const ourIdentityPromise  = this.storage.getOurIdentity();

            if (!await trustedPromise) {
                throw new errors.UntrustedIdentityKeyError(this.addr.id, device.identityKey);
            }

            const ourIdentityKey  = await ourIdentityPromise;
            const devicePreKey    = device.preKey && device.preKey.publicKey;

            // Executa todo o crypto CPU-bound no worker thread e carrega a sessão existente
            // em paralelo, pois são operações independentes.
            const [workerResult, record] = await Promise.all([
                _runInCryptoWorker({
                    ourIdentityPrivKey:  ourIdentityKey.privKey,
                    theirIdentityPubKey: device.identityKey,
                    theirSignedPubKey:   device.signedPreKey.publicKey,
                    theirEphemeralPubKey: devicePreKey || null,
                }),
                this.storage.loadSession(fqAddr),
            ]);

            // Reconstrói Buffers (structured clone transforma Buffer em Uint8Array).
            const baseKeyPub     = Buffer.from(workerResult.baseKeyPub);
            const ratchetKeyPub  = Buffer.from(workerResult.ratchetKeyPub);
            const ratchetKeyPriv = Buffer.from(workerResult.ratchetKeyPriv);

            const session = SessionRecord.createEntry();
            session.registrationId = device.registrationId;
            session.currentRatchet = {
                rootKey:               Buffer.from(workerResult.ratchetRootKey),
                ephemeralKeyPair:      { pubKey: ratchetKeyPub, privKey: ratchetKeyPriv },
                lastRemoteEphemeralKey: device.signedPreKey.publicKey,
                previousCounter:       0,
            };
            session.indexInfo = {
                created:           Date.now(),
                used:              Date.now(),
                remoteIdentityKey: device.identityKey,
                baseKey:           baseKeyPub,
                baseKeyType:       BaseKeyType.OURS,
                closed:            -1,
            };
            session.addChain(ratchetKeyPub, {
                messageKeys: {},
                chainKey: { counter: -1, key: Buffer.from(workerResult.sendingChainKey) },
                chainType: ChainType.SENDING,
            });
            session.pendingPreKey = {
                signedKeyId: device.signedPreKey.keyId,
                baseKey:     baseKeyPub,
            };
            if (device.preKey) {
                session.pendingPreKey.preKeyId = device.preKey.keyId;
            }

            let finalRecord = record;
            if (!finalRecord) {
                finalRecord = new SessionRecord();
            } else {
                const openSession = finalRecord.getOpenSession();
                if (openSession) {
                    finalRecord.closeSession(openSession);
                }
            }
            finalRecord.setSession(session);
            await this.storage.storeSession(fqAddr, finalRecord);
        });
    }

    async initIncoming(record, message) {
        const fqAddr = this.addr.toString();
        if (!await this.storage.isTrustedIdentity(fqAddr, message.identityKey)) {
            throw new errors.UntrustedIdentityKeyError(this.addr.id, message.identityKey);
        }
        if (record.getSession(message.baseKey)) {
            // This just means we haven't replied.
            return;
        }
        const preKeyPair = await this.storage.loadPreKey(message.preKeyId);
        if (message.preKeyId && !preKeyPair) {
            throw new errors.PreKeyError('Invalid PreKey ID');
        }   
        const signedPreKeyPair = await this.storage.loadSignedPreKey(message.signedPreKeyId);
        if (!signedPreKeyPair) { 
            throw new errors.PreKeyError("Missing SignedPreKey");
        }   
        const existingOpenSession = record.getOpenSession();
        if (existingOpenSession) {
            record.closeSession(existingOpenSession);
        }
        record.setSession(await this.initSession(false, preKeyPair, signedPreKeyPair,
                                                 message.identityKey, message.baseKey,
                                                 undefined, message.registrationId));
        return message.preKeyId;
    }

    async initSession(isInitiator, ourEphemeralKey, ourSignedKey, theirIdentityPubKey,
                      theirEphemeralPubKey, theirSignedPubKey, registrationId) {
        if (isInitiator) {
            if (ourSignedKey) {
                throw new Error("Invalid call to initSession");
            }
            ourSignedKey = ourEphemeralKey;
        } else {
            if (theirSignedPubKey) {
                throw new Error("Invalid call to initSession");
            }
            theirSignedPubKey = theirEphemeralPubKey;
        }
        let sharedSecret;
        if (!ourEphemeralKey || !theirEphemeralPubKey) {
            sharedSecret = new Uint8Array(32 * 4);
        } else {
            sharedSecret = new Uint8Array(32 * 5);
        }
        for (var i = 0; i < 32; i++) {
            sharedSecret[i] = 0xff;
        }
        const ourIdentityKey = await this.storage.getOurIdentity();
        const a1 = curve.calculateAgreement(theirSignedPubKey, ourIdentityKey.privKey);
        const a2 = curve.calculateAgreement(theirIdentityPubKey, ourSignedKey.privKey);
        const a3 = curve.calculateAgreement(theirSignedPubKey, ourSignedKey.privKey);
        if (isInitiator) {
            sharedSecret.set(new Uint8Array(a1), 32);
            sharedSecret.set(new Uint8Array(a2), 32 * 2);
        } else {
            sharedSecret.set(new Uint8Array(a1), 32 * 2);
            sharedSecret.set(new Uint8Array(a2), 32);
        }
        sharedSecret.set(new Uint8Array(a3), 32 * 3);
        if (ourEphemeralKey && theirEphemeralPubKey) {
            const a4 = curve.calculateAgreement(theirEphemeralPubKey, ourEphemeralKey.privKey);
            sharedSecret.set(new Uint8Array(a4), 32 * 4);
        }
        const masterKey = crypto.deriveSecrets(Buffer.from(sharedSecret), Buffer.alloc(32),
                                               Buffer.from("WhisperText"));
        const session = SessionRecord.createEntry();
        session.registrationId = registrationId;
        session.currentRatchet = {
            rootKey: masterKey[0],
            ephemeralKeyPair: isInitiator ? await curve.generateKeyPair() : ourSignedKey,
            lastRemoteEphemeralKey: theirSignedPubKey,
            previousCounter: 0
        };
        session.indexInfo = {
            created: Date.now(),
            used: Date.now(),
            remoteIdentityKey: theirIdentityPubKey,
            baseKey: isInitiator ? ourEphemeralKey.pubKey : theirEphemeralPubKey,
            baseKeyType: isInitiator ? BaseKeyType.OURS : BaseKeyType.THEIRS,
            closed: -1
        };
        if (isInitiator) {
            // If we're initiating we go ahead and set our first sending ephemeral key now,
            // otherwise we figure it out when we first maybeStepRatchet with the remote's
            // ephemeral key
            this.calculateSendingRatchet(session, theirSignedPubKey);
        }
        return session;
    }

    calculateSendingRatchet(session, remoteKey) {
        const ratchet = session.currentRatchet;
        const sharedSecret = curve.calculateAgreement(remoteKey, ratchet.ephemeralKeyPair.privKey);
        const masterKey = crypto.deriveSecrets(sharedSecret, ratchet.rootKey, Buffer.from("WhisperRatchet"));
        session.addChain(ratchet.ephemeralKeyPair.pubKey, {
            messageKeys: {},
            chainKey: {
                counter: -1,
                key: masterKey[1]
            },
            chainType: ChainType.SENDING
        });
        ratchet.rootKey = masterKey[0];
    }
}

module.exports = SessionBuilder;
