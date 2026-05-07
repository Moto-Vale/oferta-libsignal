const assert = require('assert');
const curve = require('./src/curve25519_wrapper');
const nodeCrypto = require('crypto');

const PUBLIC_KEY_DER_PREFIX = Buffer.from([
    48, 42, 48, 5, 6, 3, 43, 101, 110, 3, 33, 0
]);
  
const PRIVATE_KEY_DER_PREFIX = Buffer.from([
    48, 46, 2, 1, 0, 48, 5, 6, 3, 43, 101, 110, 4, 34, 4, 32
]);

const generateKeyPairCrypto = function() {
    const {publicKey: publicDerBytes, privateKey: privateDerBytes} = nodeCrypto.generateKeyPairSync(
        'x25519',
        {
            publicKeyEncoding: { format: 'der', type: 'spki' },
            privateKeyEncoding: { format: 'der', type: 'pkcs8' }
        }
    );
    const pubKey = publicDerBytes.slice(PUBLIC_KEY_DER_PREFIX.length, PUBLIC_KEY_DER_PREFIX.length + 32);

    const privKey = privateDerBytes.slice(PRIVATE_KEY_DER_PREFIX.length, PRIVATE_KEY_DER_PREFIX.length + 32);

    return {
        pubKey,
        privKey
    };
};

console.log('Running tests...\n');

// Test 1: Key Generation
console.log('Test 1: Key Generation');
try {
    const privateKey = new Uint8Array(32);
    for(let i = 0; i < 32; i++) privateKey[i] = i;
    
    const keyPair = curve.keyPair(privateKey);
    assert(keyPair.pubKey instanceof ArrayBuffer, 'Public key should be ArrayBuffer');
    assert(keyPair.pubKey.byteLength === 32, 'Public key should be 32 bytes');
    assert(keyPair.privKey instanceof ArrayBuffer, 'Private key should be ArrayBuffer');
    assert(keyPair.privKey.byteLength === 32, 'Private key should be 32 bytes');
    console.log('✓ Key generation works\n');
} catch (err) {
    console.error('✗ Key generation failed:', err, '\n');
}

// Test 2: Shared Secret
console.log('Test 2: Shared Secret');
try {    
    const aliceKeyPair = generateKeyPairCrypto();
    const bobKeyPair = generateKeyPairCrypto();
    
    const aliceShared = curve.sharedSecret(bobKeyPair.pubKey, aliceKeyPair.privKey);
    const bobShared = curve.sharedSecret(aliceKeyPair.pubKey, bobKeyPair.privKey);
    
    assert(aliceShared instanceof ArrayBuffer, 'Shared secret should be ArrayBuffer');
    assert(aliceShared.byteLength === 32, 'Shared secret should be 32 bytes');
    
    // Convert ArrayBuffers to arrays for comparison
    const aliceSharedArray = Array.from(new Uint8Array(aliceShared));
    const bobSharedArray = Array.from(new Uint8Array(bobShared));
    
    assert.deepStrictEqual(aliceSharedArray, bobSharedArray, 'Shared secrets should match');
    console.log('✓ Shared secret generation works\n');
} catch (err) {
    console.error('✗ Shared secret generation failed:', err, '\n');
}

// Test 2: Shared Secret And Crypto
console.log('Test 2: Shared Secret and Crypto');
try {
    const aliceKeyPair = generateKeyPairCrypto();
    const bobKeyPair = generateKeyPairCrypto();

    const aliceSharedCurve = curve.sharedSecret(bobKeyPair.pubKey, aliceKeyPair.privKey);
    const nodePrivateKey = nodeCrypto.createPrivateKey({
        key: Buffer.concat([PRIVATE_KEY_DER_PREFIX, Buffer.from(aliceKeyPair.privKey)]),
        format: 'der',
        type: 'pkcs8'
    });
    const nodePublicKey = nodeCrypto.createPublicKey({
        key: Buffer.concat([PUBLIC_KEY_DER_PREFIX, Buffer.from(bobKeyPair.pubKey)]),
        format: 'der',
        type: 'spki'
    });
    
    const aliceSharedCrypto =nodeCrypto.diffieHellman({
        privateKey: nodePrivateKey,
        publicKey: nodePublicKey,
    });
    // Convert ArrayBuffers to arrays for comparison
    const aliceSharedArrayCurve = Array.from(new Uint8Array(aliceSharedCurve));
    const aliceSharedArrayCrypto = Array.from(new Uint8Array(aliceSharedCrypto));
    
    console.log('curveResult is:', typeof aliceSharedCurve);
    assert.deepStrictEqual(aliceSharedArrayCurve, aliceSharedArrayCrypto, 'Shared secrets should match');
    console.log('✓ Shared secret generation works\n');
} catch (err) {
    console.error('✗ Shared secret generation failed:', err, '\n');
}

// Test 3: Signing and Verification
console.log('Test 3: Signing and Verification');
try {
    const privateKey = new Uint8Array(32);
    for(let i = 0; i < 32; i++) privateKey[i] = i;
    
    const keyPair = curve.keyPair(privateKey);
    const message = new Uint8Array([1, 2, 3, 4, 5]);
    
    const signature = curve.sign(keyPair.privKey, message);
    assert(signature instanceof ArrayBuffer, 'Signature should be ArrayBuffer');
    assert(signature.byteLength === 64, 'Signature should be 64 bytes');
    
    const isValid = curve.verify(keyPair.pubKey, message, signature);
    assert(isValid === true, 'Signature verification should succeed');
    
    // Test invalid signature
    const invalidMessage = new Uint8Array([5, 4, 3, 2, 1]);
    const isInvalid = curve.verify(keyPair.pubKey, invalidMessage, signature);
    assert(isInvalid === false, 'Invalid signature verification should fail');
    
    console.log('✓ Signing and verification work\n');
} catch (err) {
    console.error('✗ Signing and verification failed:', err, '\n');
}

// ─── SessionRecord._openSession cache ───────────────────────────────────────

const SessionRecord = require('./src/session_record');

function makeSession(closedAt = -1) {
    const key = Buffer.alloc(33, Math.random() * 255 | 0);
    const s = SessionRecord.createEntry();
    s.registrationId = 1;
    s.indexInfo = {
        baseKey: key,
        baseKeyType: 2, // THEIRS
        closed: closedAt,
        used: Date.now(),
        created: Date.now(),
        remoteIdentityKey: Buffer.alloc(33, 1)
    };
    s.currentRatchet = {
        ephemeralKeyPair: { pubKey: Buffer.alloc(33, 2), privKey: Buffer.alloc(32, 3) },
        lastRemoteEphemeralKey: Buffer.alloc(33, 4),
        previousCounter: 0,
        rootKey: Buffer.alloc(32, 5)
    };
    s._chains = {};
    return s;
}

console.log('Test 4: SessionRecord._openSession cache — getOpenSession O(1) após setSession');
try {
    const record = new SessionRecord();
    assert.strictEqual(record._openSession, null, 'cache deve iniciar null');

    const open = makeSession(-1);
    record.setSession(open);

    assert.strictEqual(record._openSession, open, 'cache deve apontar para sessão aberta');
    assert.strictEqual(record.getOpenSession(), open, 'getOpenSession deve retornar a mesma referência');
    console.log('✓ cache atualizado por setSession\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 5: SessionRecord._openSession cache — closeSession invalida cache');
try {
    const record = new SessionRecord();
    const open = makeSession(-1);
    record.setSession(open);

    record.closeSession(open);

    assert.strictEqual(record._openSession, null, 'cache deve ser null após closeSession');
    assert.strictEqual(record.getOpenSession(), undefined, 'getOpenSession deve retornar undefined sem sessão aberta');
    console.log('✓ cache invalidado por closeSession\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 6: SessionRecord._openSession cache — openSession atualiza cache');
try {
    const record = new SessionRecord();
    const closed = makeSession(Date.now());
    record.setSession(closed);

    assert.strictEqual(record._openSession, null, 'cache deve ser null para sessão fechada');

    record.openSession(closed);

    assert.strictEqual(record._openSession, closed, 'cache deve apontar após openSession');
    assert.strictEqual(record.getOpenSession(), closed, 'getOpenSession deve retornar sessão reaberta');
    console.log('✓ cache atualizado por openSession\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 7: SessionRecord._openSession cache — fallback scan após deserialização');
try {
    const record = new SessionRecord();
    // Adiciona manualmente ao mapa (simulando deserialização, sem passar por setSession)
    const open = makeSession(-1);
    const key = open.indexInfo.baseKey.toString('base64');
    record.sessions[key] = open;
    // _openSession ainda está null, mas getOpenSession deve encontrar via scan
    assert.strictEqual(record._openSession, null, 'antes do scan cache é null');
    const found = record.getOpenSession();
    assert.strictEqual(found, open, 'scan deve encontrar a sessão aberta');
    assert.strictEqual(record._openSession, open, 'cache deve ser preenchido pelo scan');
    // Segunda chamada deve usar cache (sem scan)
    assert.strictEqual(record.getOpenSession(), open, 'segunda chamada usa cache');
    console.log('✓ fallback scan funciona e aquece cache\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 8: SessionRecord._openSession cache — deleteAllSessions limpa cache');
try {
    const record = new SessionRecord();
    const open = makeSession(-1);
    record.setSession(open);

    record.deleteAllSessions();

    assert.strictEqual(record._openSession, null, 'cache deve ser null após deleteAllSessions');
    assert.deepStrictEqual(record.sessions, {}, 'sessions deve estar vazio');
    console.log('✓ cache limpo por deleteAllSessions\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 9: SessionRecord._openSession cache — múltiplas sessões, apenas a aberta é retornada');
try {
    const record = new SessionRecord();
    const closed1 = makeSession(Date.now() - 2000);
    const closed2 = makeSession(Date.now() - 1000);
    const open    = makeSession(-1);

    record.setSession(closed1);
    record.setSession(closed2);
    record.setSession(open);

    assert.strictEqual(record.getOpenSession(), open, 'deve retornar somente a sessão aberta');
    assert.strictEqual(record._openSession, open, 'cache aponta para sessão aberta');
    console.log('✓ múltiplas sessões — cache correto\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

// ─── lastUsedSessionId: serialize / deserialize ──────────────────────────────

console.log('Test 10: lastUsedSessionId é salvo no JSON serializado');
try {
    const record = new SessionRecord();
    const open = makeSession(-1);
    record.setSession(open);

    const json = record.serialize();

    assert.ok('lastUsedSessionId' in json, 'JSON deve conter a chave lastUsedSessionId');
    const expectedId = open.indexInfo.baseKey.toString('base64');
    assert.strictEqual(json.lastUsedSessionId, expectedId, 'lastUsedSessionId no JSON deve ser a baseKey da sessão aberta');
    console.log('  lastUsedSessionId no JSON:', json.lastUsedSessionId);
    console.log('✓ lastUsedSessionId está presente e correto no JSON serializado\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 11: lastUsedSessionId é restaurado após deserialize');
try {
    const record = new SessionRecord();
    const open = makeSession(-1);
    record.setSession(open);

    const json = record.serialize();
    const restored = SessionRecord.deserialize(json);

    const expectedId = open.indexInfo.baseKey.toString('base64');
    assert.strictEqual(restored.lastUsedSessionId, expectedId, 'lastUsedSessionId deve ser restaurado após deserialize');
    console.log('  lastUsedSessionId restaurado:', restored.lastUsedSessionId);
    console.log('✓ lastUsedSessionId restaurado corretamente após deserialize\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 12: getOpenSession usa lastUsedSessionId (O(1)) após deserialize');
try {
    const record = new SessionRecord();
    const closed = makeSession(Date.now() - 5000);
    const open   = makeSession(-1);
    record.setSession(closed);
    record.setSession(open);

    const json = record.serialize();
    const restored = SessionRecord.deserialize(json);

    // _openSession deve ser null (não foi preenchido ainda)
    assert.strictEqual(restored._openSession, null, '_openSession deve ser null logo após deserialize');

    // Spy: verifica que o lastUsedSessionId aponta para a sessão correta antes do scan
    const expectedId = open.indexInfo.baseKey.toString('base64');
    assert.strictEqual(restored.lastUsedSessionId, expectedId, 'lastUsedSessionId deve apontar para sessão aberta');

    const found = restored.getOpenSession();
    assert.strictEqual(found, restored.sessions[expectedId], 'getOpenSession deve retornar a sessão identificada por lastUsedSessionId');
    assert.strictEqual(restored._openSession, found, 'cache deve ser aquecido pela lookup por lastUsedSessionId');
    console.log('  getOpenSession retornou sessão com baseKey:', found.indexInfo.baseKey.toString('base64').slice(0, 12) + '...');
    console.log('✓ getOpenSession usa lastUsedSessionId primeiro após deserialize\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 13: lastUsedSessionId null quando não há sessão aberta');
try {
    const record = new SessionRecord();
    const closed = makeSession(Date.now() - 1000);
    record.setSession(closed);

    const json = record.serialize();
    // lastUsedSessionId deve ser null (nenhuma sessão aberta foi definida)
    // (setSession de sessão fechada não atualiza lastUsedSessionId)
    assert.strictEqual(json.lastUsedSessionId, null, 'lastUsedSessionId deve ser null quando só há sessões fechadas');
    console.log('  lastUsedSessionId no JSON:', json.lastUsedSessionId);
    console.log('✓ lastUsedSessionId permanece null quando não há sessão aberta\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

// ─── getSessions: lastUsed primeiro ─────────────────────────────────────────

console.log('Test 14: getSessions — lastUsed vem primeiro, demais em seguida');
try {
    const record = new SessionRecord();
    const s1 = makeSession(Date.now() - 3000);
    const s2 = makeSession(Date.now() - 2000);
    const open = makeSession(-1);

    record.setSession(s1);
    record.setSession(s2);
    record.setSession(open); // esta será a lastUsedSessionId

    const sessions = record.getSessions();

    assert.strictEqual(sessions[0], open, 'primeira sessão deve ser a lastUsed (aberta)');
    assert.ok(sessions.includes(s1), 'lista deve conter s1');
    assert.ok(sessions.includes(s2), 'lista deve conter s2');
    assert.strictEqual(sessions.length, 3, 'deve retornar todas as sessões');
    console.log('  ordem:', sessions.map((s, i) =>
        `[${i}] closed=${s.indexInfo.closed === -1 ? 'open' : 'closed'}`).join(', '));
    console.log('✓ lastUsed é o primeiro elemento de getSessions\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 15: getSessions após deserialize — lastUsed restaurado vem primeiro');
try {
    const record = new SessionRecord();
    const older = makeSession(Date.now() - 5000);
    const newer = makeSession(Date.now() - 1000);
    const open  = makeSession(-1);

    record.setSession(older);
    record.setSession(newer);
    record.setSession(open);

    const json = record.serialize();
    const restored = SessionRecord.deserialize(json);

    const sessions = restored.getSessions();

    const expectedId = open.indexInfo.baseKey.toString('base64');
    assert.strictEqual(
        sessions[0].indexInfo.baseKey.toString('base64'),
        expectedId,
        'após deserialize, a sessão lastUsed deve vir primeiro'
    );
    assert.strictEqual(sessions.length, 3, 'deve retornar todas as sessões');
    console.log('  [0] baseKey:', sessions[0].indexInfo.baseKey.toString('base64').slice(0, 12) + '... (lastUsed)');
    console.log('✓ getSessions após deserialize respeita lastUsedSessionId\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('Test 16: getSessions — sem lastUsed aberto, ordena por indexInfo.used');
try {
    const now = Date.now();
    const record = new SessionRecord();
    const old1 = makeSession(now - 3000);
    old1.indexInfo.used = now - 3000;
    const old2 = makeSession(now - 1000);
    old2.indexInfo.used = now - 1000;

    // Insere sem sessão aberta
    record.sessions[old1.indexInfo.baseKey.toString('base64')] = old1;
    record.sessions[old2.indexInfo.baseKey.toString('base64')] = old2;

    const sessions = record.getSessions();

    assert.strictEqual(sessions[0], old2, 'sessão mais recentemente usada deve vir primeiro');
    assert.strictEqual(sessions[1], old1, 'sessão mais antiga vem depois');
    console.log('  [0] used:', sessions[0].indexInfo.used, '(mais recente)');
    console.log('  [1] used:', sessions[1].indexInfo.used, '(mais antigo)');
    console.log('✓ sem lastUsed aberto, getSessions ordena por indexInfo.used\n');
} catch (err) {
    console.error('✗ falhou:', err, '\n');
}

console.log('All tests completed!');
