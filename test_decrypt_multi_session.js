"use strict";

const assert = require("assert");
const SessionCipher = require("./src/session_cipher");
const SessionRecord = require("./src/session_record");
const SessionEntry = SessionRecord.SessionEntry;
const SessionBuilder = require("./src/session_builder");
const ProtocolAddress = require("./src/protocol_address");
const KeyHelper = require("./src/keyhelper");
const curve = require("./src/curve");

// ---------------------------------------------------------------------------
// In-memory storage
// ---------------------------------------------------------------------------
class InMemoryStorage {
  constructor() {
    this.identityKeyPair = null;
    this.registrationId = null;
    this._identities = new Map();
    this._preKeys = new Map();
    this._signedPreKeys = new Map();
    this._sessions = new Map();
  }

  async getOurIdentity() {
    return this.identityKeyPair;
  }
  async getOurRegistrationId() {
    return this.registrationId;
  }
  async isTrustedIdentity(identifier, identityKey) {
    const stored = this._identities.get(identifier);
    if (!stored) return true;
    return stored.equals(identityKey);
  }
  async saveIdentity(identifier, identityKey) {
    this._identities.set(identifier, identityKey);
    return false;
  }
  async loadPreKey(keyId) {
    return this._preKeys.get(keyId);
  }
  async removePreKey(keyId) {
    this._preKeys.delete(keyId);
  }
  async loadSignedPreKey(keyId) {
    return this._signedPreKeys.get(keyId);
  }
  async loadSession(identifier) {
    return this._sessions.get(identifier);
  }
  async storeSession(identifier, record) {
    this._sessions.set(identifier, record);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

/**
 * Cria um par de usuários (Alice → Bob) com sessão já estabelecida via
 * PreKey exchange, retornando storage/cipher de ambos e os endereços.
 */
async function setupSession() {
  // ----- Identidades -----
  const aliceStorage = new InMemoryStorage();
  aliceStorage.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  aliceStorage.registrationId = KeyHelper.generateRegistrationId();

  const bobStorage = new InMemoryStorage();
  bobStorage.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  bobStorage.registrationId = KeyHelper.generateRegistrationId();

  // ----- Pre-keys de Bob -----
  const preKeyId = 1;
  const signedPreKeyId = 1;
  const preKey = await KeyHelper.generatePreKey(preKeyId);
  const signedPreKey = await KeyHelper.generateSignedPreKey(
    bobStorage.identityKeyPair,
    signedPreKeyId
  );
  bobStorage._preKeys.set(preKeyId, preKey.keyPair);
  bobStorage._signedPreKeys.set(signedPreKeyId, signedPreKey.keyPair);

  // ----- Endereços -----
  const aliceAddr = new ProtocolAddress("+15550000001", 1);
  const bobAddr = new ProtocolAddress("+15550000002", 1);

  // ----- Alice inicializa sessão outgoing com Bob -----
  const aliceBuilder = new SessionBuilder(aliceStorage, bobAddr);
  await aliceBuilder.initOutgoing({
    registrationId: bobStorage.registrationId,
    identityKey: bobStorage.identityKeyPair.pubKey,
    signedPreKey: {
      keyId: signedPreKeyId,
      publicKey: signedPreKey.keyPair.pubKey,
      signature: signedPreKey.signature,
    },
    preKey: {
      keyId: preKeyId,
      publicKey: preKey.keyPair.pubKey,
    },
  });

  // ----- Ciphers -----
  const aliceCipher = new SessionCipher(aliceStorage, bobAddr);
  const bobCipher = new SessionCipher(bobStorage, aliceAddr);

  // ----- Troca inicial: PreKeyWhisperMessage -----
  const firstMsg = await aliceCipher.encrypt(Buffer.from("hello"));
  assert.strictEqual(firstMsg.type, 3, "Deve ser PreKeyWhisperMessage");
  const firstPlain = await bobCipher.decryptPreKeyWhisperMessage(firstMsg.body);
  assert.strictEqual(firstPlain.toString(), "hello");

  // ----- Bob responde para limpar pendingPreKey de Alice -----
  const bobReply = await bobCipher.encrypt(Buffer.from("hi"));
  await aliceCipher.decryptWhisperMessage(bobReply.body);

  // Agora Alice envia WhisperMessages (pendingPreKey foi removida)
  return { aliceStorage, bobStorage, aliceAddr, bobAddr, aliceCipher, bobCipher };
}

/**
 * Injeta `n` sessões fechadas sintéticas no registro de Bob para Alice,
 * simulando um histórico de sessões acumuladas.
 */
async function injectClosedSessions(bobStorage, aliceAddr, n) {
  const record = await bobStorage.loadSession(aliceAddr.toString());

  for (let i = 0; i < n; i++) {
    const fakeKey = await curve.generateKeyPair();
    const entry = SessionRecord.createEntry();
    entry.registrationId = 100 + i;
    entry.currentRatchet = {
      ephemeralKeyPair: await curve.generateKeyPair(),
      lastRemoteEphemeralKey: fakeKey.pubKey,
      previousCounter: 0,
      rootKey: Buffer.alloc(32, i + 1),
    };
    entry.indexInfo = {
      baseKey: fakeKey.pubKey,
      baseKeyType: 1,
      closed: Date.now() - (n - i) * 10000, // timestamps crescentes
      used: Date.now() - (n - i) * 10000 - 100,
      created: Date.now() - (n - i) * 10000 - 100,
      remoteIdentityKey: Buffer.alloc(33, 5),
    };
    // Cadeia de envio fechada (sem chave ativa)
    const chainKey = await curve.generateKeyPair();
    entry.addChain(chainKey.pubKey, {
      messageKeys: {},
      chainKey: { counter: 0, key: undefined },
      chainType: 1, // SENDING
    });
    record.sessions[fakeKey.pubKey.toString("base64")] = entry;
  }

  await bobStorage.storeSession(aliceAddr.toString(), record);
  return record;
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------
(async () => {
  console.log("\nSessionCipher — decryptWhisperMessage com múltiplas sessões\n");

  await test("decripta mensagem simples (sem sessões extras)", async () => {
    const { aliceCipher, bobCipher } = await setupSession();
    const ct = await aliceCipher.encrypt(Buffer.from("test1"));
    assert.strictEqual(ct.type, 1, "Deve ser WhisperMessage após troca inicial");
    const plain = await bobCipher.decryptWhisperMessage(ct.body);
    assert.strictEqual(plain.toString(), "test1");
  });

  await test("decripta com 5 sessões fechadas injetadas", async () => {
    const { aliceAddr, bobStorage, aliceCipher, bobCipher } =
      await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 5);

    const ct = await aliceCipher.encrypt(Buffer.from("multi5"));
    const plain = await bobCipher.decryptWhisperMessage(ct.body);
    assert.strictEqual(plain.toString(), "multi5");
  });

  await test("decripta com 20 sessões fechadas injetadas", async () => {
    const { aliceAddr, bobStorage, aliceCipher, bobCipher } =
      await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 20);

    const ct = await aliceCipher.encrypt(Buffer.from("multi20"));
    const plain = await bobCipher.decryptWhisperMessage(ct.body);
    assert.strictEqual(plain.toString(), "multi20");
  });

  await test("sessão ativa ainda está aberta após decriptação", async () => {
    const { aliceAddr, bobStorage, aliceCipher, bobCipher } =
      await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 10);

    const ct = await aliceCipher.encrypt(Buffer.from("check"));
    await bobCipher.decryptWhisperMessage(ct.body);

    const record = await bobStorage.loadSession(aliceAddr.toString());
    assert.ok(record.haveOpenSession(), "Bob ainda deve ter sessão aberta");
  });

  await test("múltiplas mensagens consecutivas com sessões injetadas", async () => {
    const { aliceAddr, bobStorage, aliceCipher, bobCipher } =
      await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 15);

    const messages = ["um", "dois", "três", "quatro", "cinco"];
    for (const msg of messages) {
      const ct = await aliceCipher.encrypt(Buffer.from(msg));
      const plain = await bobCipher.decryptWhisperMessage(ct.body);
      assert.strictEqual(plain.toString(), msg);
    }
  });

  await test("getSessions() retorna a sessão ativa na primeira posição", async () => {
    const { aliceAddr, bobStorage } = await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 8);

    const record = await bobStorage.loadSession(aliceAddr.toString());
    const sessions = record.getSessions();
    const list = Array.isArray(sessions) ? sessions : [...sessions];
    assert.ok(list.length > 0);
    assert.strictEqual(list[0].indexInfo.closed, -1, "Primeira deve ser a aberta");
  });

  await test("falha esperada: WhisperMessage inválido lança SessionError", async () => {
    const { bobCipher } = await setupSession();
    const garbage = Buffer.alloc(100, 0xaa);
    await assert.rejects(
      () => bobCipher.decryptWhisperMessage(garbage),
      /No matching sessions|Incompatible version/
    );
  });

  // ---------------------------------------------------------------------------
  // Testes de eager / lazy desserialização
  // ---------------------------------------------------------------------------
  console.log("\nEager / lazy desserialização\n");

  await test("sessão aberta é desserializada eagerly (instanceof SessionEntry)", async () => {
    const { bobStorage, aliceAddr } = await setupSession();
    const record = await bobStorage.loadSession(aliceAddr.toString());

    const restored = SessionRecord.deserialize(record.serialize());

    const openSession = restored.getOpenSession();
    assert.ok(openSession, "Deve haver sessão aberta");
    assert.ok(
      openSession instanceof SessionEntry,
      "Sessão aberta deve ser SessionEntry (eager)"
    );
  });

  await test("as 2 sessões fechadas mais recentes são eager (instanceof SessionEntry)", async () => {
    const { bobStorage, aliceAddr } = await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 20);

    const record = await bobStorage.loadSession(aliceAddr.toString());
    const restored = SessionRecord.deserialize(record.serialize());

    const closedSessions = Object.values(restored.sessions)
      .filter((s) => s.indexInfo.closed !== -1)
      .sort((a, b) => b.indexInfo.closed - a.indexInfo.closed);

    assert.ok(closedSessions.length >= 2, "Deve haver pelo menos 2 sessões fechadas");
    assert.ok(
      closedSessions[0] instanceof SessionEntry,
      "1ª sessão fechada mais recente deve ser eager"
    );
    assert.ok(
      closedSessions[1] instanceof SessionEntry,
      "2ª sessão fechada mais recente deve ser eager"
    );
  });

  await test("sessões fechadas além das 2 mais recentes são lazy (plain object)", async () => {
    const { bobStorage, aliceAddr } = await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 20);

    const record = await bobStorage.loadSession(aliceAddr.toString());
    const restored = SessionRecord.deserialize(record.serialize());

    const closedSessions = Object.values(restored.sessions)
      .filter((s) => s.indexInfo.closed !== -1)
      .sort((a, b) => b.indexInfo.closed - a.indexInfo.closed);

    assert.ok(closedSessions.length > 2, "Deve haver mais de 2 sessões fechadas");
    for (let i = 2; i < closedSessions.length; i++) {
      assert.ok(
        !(closedSessions[i] instanceof SessionEntry),
        `Sessão fechada [${i}] deve ser lazy (plain object, não SessionEntry)`
      );
    }
  });

  await test("exatamente 1 aberta + 2 eager + restante lazy após 5 sessões fechadas", async () => {
    const { bobStorage, aliceAddr } = await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 20);

    const record = await bobStorage.loadSession(aliceAddr.toString());
    const restored = SessionRecord.deserialize(record.serialize());

    const all = Object.values(restored.sessions);
    const openEntries = all.filter((s) => s.indexInfo.closed === -1);
    const eagerClosed = all.filter(
      (s) => s.indexInfo.closed !== -1 && s instanceof SessionEntry
    );
    const lazyClosed = all.filter(
      (s) => s.indexInfo.closed !== -1 && !(s instanceof SessionEntry)
    );

    assert.strictEqual(openEntries.length, 1, "Exatamente 1 sessão aberta");
    assert.strictEqual(eagerClosed.length, 2, "Exatamente 2 sessões fechadas eager");
    assert.strictEqual(lazyClosed.length, 18, "Exatamente 18 sessões fechadas lazy");
  });

  await test("round-trip duplo preserva número de sessões e sessão aberta", async () => {
    const { bobStorage, aliceAddr } = await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 20);

    const record = await bobStorage.loadSession(aliceAddr.toString());
    const totalSessions = Object.keys(record.sessions).length;

    // 1ª volta: serialize → deserialize (lazy sessions geradas)
    const restored1 = SessionRecord.deserialize(record.serialize());
    // 2ª volta: serialize → deserialize (lazy sessions repassadas como plain object)
    const restored2 = SessionRecord.deserialize(restored1.serialize());

    assert.strictEqual(
      Object.keys(restored2.sessions).length,
      totalSessions,
      "Número de sessões preservado após 2 round-trips"
    );
    assert.ok(
      restored2.haveOpenSession(),
      "Sessão aberta preservada após 2 round-trips"
    );
  });

  await test("lazy sessions são repassadas intactas na re-serialização", async () => {
    const { bobStorage, aliceAddr } = await setupSession();
    await injectClosedSessions(bobStorage, aliceAddr, 5);

    const record = await bobStorage.loadSession(aliceAddr.toString());
    const serialized1 = record.serialize();
    const restored1 = SessionRecord.deserialize(serialized1);
    const serialized2 = restored1.serialize();

    // Todas as chaves de sessão devem ser preservadas
    const keys1 = Object.keys(serialized1._sessions).sort();
    const keys2 = Object.keys(serialized2._sessions).sort();
    assert.deepStrictEqual(keys2, keys1, "Chaves de sessão devem ser idênticas");

    // Dados de sessão lazy devem ser bit-a-bit iguais
    for (const key of keys1) {
      const s1 = serialized1._sessions[key];
      const s2 = serialized2._sessions[key];
      assert.deepStrictEqual(
        s2,
        s1,
        `Dados da sessão ${key.slice(0, 8)}… devem ser idênticos`
      );
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
})();
