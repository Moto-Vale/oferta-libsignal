'use strict';

const { parentPort } = require('worker_threads');
const curve = require('./curve');
const cryptoLib = require('./crypto');

parentPort.on('message', ({ id, data }) => {
    try {
        const result = initOutgoingCrypto(data);
        parentPort.postMessage({ id, result });
    } catch (err) {
        parentPort.postMessage({ id, error: err.message });
    }
});

/**
 * Executa todas as operações de curva e derivação de chaves para initOutgoing.
 * Roda em um worker thread para não bloquear o event loop.
 *
 * Recebe as chaves serializadas e retorna os resultados do handshake X3DH
 * junto com o primeiro passo de ratchet (sendingRatchet).
 */
function initOutgoingCrypto({
    ourIdentityPrivKey,
    theirIdentityPubKey,
    theirSignedPubKey,
    theirEphemeralPubKey,  // null quando device não tem preKey
}) {
    // Structured clone transforma Buffers em Uint8Array; restauramos aqui.
    ourIdentityPrivKey  = Buffer.from(ourIdentityPrivKey);
    theirIdentityPubKey = Buffer.from(theirIdentityPubKey);
    theirSignedPubKey   = Buffer.from(theirSignedPubKey);
    const hasEphemeral  = !!theirEphemeralPubKey;
    if (hasEphemeral) theirEphemeralPubKey = Buffer.from(theirEphemeralPubKey);

    // Gera a baseKey (ephemeral key) do lado do iniciador
    const baseKey = curve.generateKeyPair();

    // X3DH — isInitiator=true: ourSignedKey = ourEphemeralKey = baseKey
    const sharedSecret = new Uint8Array(hasEphemeral ? 32 * 5 : 32 * 4);
    for (let i = 0; i < 32; i++) sharedSecret[i] = 0xff;

    const a1 = curve.calculateAgreement(theirSignedPubKey,   ourIdentityPrivKey);   // DH1
    const a2 = curve.calculateAgreement(theirIdentityPubKey, baseKey.privKey);       // DH2
    const a3 = curve.calculateAgreement(theirSignedPubKey,   baseKey.privKey);       // DH3

    sharedSecret.set(new Uint8Array(a1), 32);
    sharedSecret.set(new Uint8Array(a2), 32 * 2);
    sharedSecret.set(new Uint8Array(a3), 32 * 3);

    if (hasEphemeral) {
        const a4 = curve.calculateAgreement(theirEphemeralPubKey, baseKey.privKey);  // DH4
        sharedSecret.set(new Uint8Array(a4), 32 * 4);
    }

    const masterKey = cryptoLib.deriveSecrets(
        Buffer.from(sharedSecret),
        Buffer.alloc(32),
        Buffer.from('WhisperText')
    );

    // Gera o ephemeral key pair de ratchet para o primeiro envio
    const ratchetKeyPair = curve.generateKeyPair();

    // calculateSendingRatchet inline
    const ratchetSecret    = curve.calculateAgreement(theirSignedPubKey, ratchetKeyPair.privKey);
    const ratchetMasterKey = cryptoLib.deriveSecrets(
        ratchetSecret,
        masterKey[0],
        Buffer.from('WhisperRatchet')
    );

    return {
        baseKeyPub:      baseKey.pubKey,
        baseKeyPriv:     baseKey.privKey,
        ratchetKeyPub:   ratchetKeyPair.pubKey,
        ratchetKeyPriv:  ratchetKeyPair.privKey,
        ratchetRootKey:  ratchetMasterKey[0],   // rootKey pós-ratchet
        sendingChainKey: ratchetMasterKey[1],   // chave da sending chain
    };
}
