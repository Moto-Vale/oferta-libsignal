const assert = require("assert");
const SessionRecord = require("./src/session_record");

// JSON real com 41 sessões (40 fechadas + 1 aberta)
const FIXTURE = {
  _sessions: {
    BRfWmY5RWyYWvaoQsWu6PvT7IUelEBaZOWxrGwiVWUIv: {
      registrationId: 187,
      currentRatchet: {
        ephemeralKeyPair: {
          pubKey: "BUrS+PtHt1P04WmJ2sR2kjONp1wns8W/w/FlSmJ5hBIo",
          privKey: "cGBmbP1LyH22HmVtgaSACrkh5o5WcPnpkHfHOJ+pN3g=",
        },
        lastRemoteEphemeralKey: "BXdf0aoC+V/X6ljacg3j6Mmxx2jfR+IrqCXVW2RgIpYh",
        previousCounter: 0,
        rootKey: "S1cz+vqxZK4m/p3e8Z5NjZHYWM5ECxovN3Acq1ss0G0=",
      },
      indexInfo: {
        baseKey: "BRfWmY5RWyYWvaoQsWu6PvT7IUelEBaZOWxrGwiVWUIv",
        baseKeyType: 1,
        closed: 1778179699911,
        used: 1778179686763,
        created: 1778179686763,
        remoteIdentityKey: "BQpUIhcU2d4aQFP/bkkT7yDKLFsirDQj54qM4NB1Acd6",
      },
      _chains: {
        "BUrS+PtHt1P04WmJ2sR2kjONp1wns8W/w/FlSmJ5hBIo": {
          chainKey: { counter: 0, key: "JtPZEyE00Fx9J66fYK7p68w8aIDX2p2GELQo1OXijZE=" },
          chainType: 1,
          messageKeys: {},
        },
      },
      pendingPreKey: { signedKeyId: 1, baseKey: "BRfWmY5RWyYWvaoQsWu6PvT7IUelEBaZOWxrGwiVWUIv" },
    },
    BXlK454tPyob6dS5SW9wtrX_LJSEeKMFEPFOT_pNOXsB: {
      registrationId: 187,
      currentRatchet: {
        ephemeralKeyPair: {
          pubKey: "BRsGUTHCjBKCEmwbP+fvBT6Gg2PAktGQ2SHj20E7PJMf",
          privKey: "ICeGHgtBzUSfXKSdXJgI8MxW9xjnV+nd3mCD0krGtFs=",
        },
        lastRemoteEphemeralKey: "BXdf0aoC+V/X6ljacg3j6Mmxx2jfR+IrqCXVW2RgIpYh",
        previousCounter: 0,
        rootKey: "giSzmEPCvOWm0wEW6Upzj2h1fzoyYb+JtIOTD3zXvJI=",
      },
      indexInfo: {
        baseKey: "BXlK454tPyob6dS5SW9wtrX/LJSEeKMFEPFOT+pNOXsB",
        baseKeyType: 1,
        closed: 1778179711776,
        used: 1778179699910,
        created: 1778179699910,
        remoteIdentityKey: "BQpUIhcU2d4aQFP/bkkT7yDKLFsirDQj54qM4NB1Acd6",
      },
      _chains: {
        BRsGUTHCjBKCEmwbP_fvBT6Gg2PAktGQ2SHj20E7PJMf: {
          chainKey: { counter: 0, key: "btn7aPIHx2pWX6AWy2QDVX0RHhO9c/GZV82ChSY1/Hw=" },
          chainType: 1,
          messageKeys: {},
        },
      },
      pendingPreKey: { signedKeyId: 1, baseKey: "BXlK454tPyob6dS5SW9wtrX/LJSEeKMFEPFOT+pNOXsB" },
    },
    // Sessão aberta (closed: -1) — a mais recente
    "BdauT5GQh1WiRBd6fP95vqvUbOhaI358672RG/4zORI0": {
      registrationId: 187,
      currentRatchet: {
        ephemeralKeyPair: {
          pubKey: "Bd5FipThMfb4gXGXuFr/rdgDmlfN+A50h4aOlDsK8Y85",
          privKey: "6P7p9rhN+I96EmSGzBqeObjOtGt78aGFAMcLTF5AXWQ=",
        },
        lastRemoteEphemeralKey: "BXdf0aoC+V/X6ljacg3j6Mmxx2jfR+IrqCXVW2RgIpYh",
        previousCounter: 0,
        rootKey: "6Ms1iyqt54EVdso+bQ2tbjj4H8NNfx3hg/IOOdgXA5w=",
      },
      indexInfo: {
        baseKey: "BdauT5GQh1WiRBd6fP95vqvUbOhaI358672RG/4zORI0",
        baseKeyType: 1,
        closed: -1,
        used: 1778180316413,
        created: 1778180316413,
        remoteIdentityKey: "BQpUIhcU2d4aQFP/bkkT7yDKLFsirDQj54qM4NB1Acd6",
      },
      _chains: {
        "Bd5FipThMfb4gXGXuFr/rdgDmlfN+A50h4aOlDsK8Y85": {
          chainKey: { counter: 677, key: "il+2uOslmZGu20SKgWGnjINbgso8PnU0ytna5dUS7HM=" },
          chainType: 1,
          messageKeys: {},
        },
      },
      pendingPreKey: { signedKeyId: 1, baseKey: "BdauT5GQh1WiRBd6fP95vqvUbOhaI358672RG/4zORI0" },
    },
  },
  version: "v1",
};

// Cria fixture com N sessões fechadas + 1 aberta
function buildFixture(closedCount) {
  const sessions = {};
  for (let i = 0; i < closedCount; i++) {
    const key = `closed_session_${i}`;
    sessions[key] = {
      registrationId: 100 + i,
      currentRatchet: {
        ephemeralKeyPair: {
          pubKey: Buffer.alloc(33, i).toString("base64"),
          privKey: Buffer.alloc(32, i).toString("base64"),
        },
        lastRemoteEphemeralKey: Buffer.alloc(33, 1).toString("base64"),
        previousCounter: 0,
        rootKey: Buffer.alloc(32, 2).toString("base64"),
      },
      indexInfo: {
        baseKey: key,
        baseKeyType: 1,
        closed: 1000000 + i * 1000, // timestamps crescentes
        used: 900000 + i * 1000,
        created: 900000 + i * 1000,
        remoteIdentityKey: Buffer.alloc(33, 3).toString("base64"),
      },
      _chains: {},
      pendingPreKey: { signedKeyId: 1, baseKey: key },
    };
  }

  const openKey = "open_session";
  sessions[openKey] = {
    registrationId: 187,
    currentRatchet: {
      ephemeralKeyPair: {
        pubKey: Buffer.alloc(33, 9).toString("base64"),
        privKey: Buffer.alloc(32, 9).toString("base64"),
      },
      lastRemoteEphemeralKey: Buffer.alloc(33, 1).toString("base64"),
      previousCounter: 0,
      rootKey: Buffer.alloc(32, 2).toString("base64"),
    },
    indexInfo: {
      baseKey: openKey,
      baseKeyType: 1,
      closed: -1,
      used: 9999999,
      created: 9999999,
      remoteIdentityKey: Buffer.alloc(33, 3).toString("base64"),
    },
    _chains: {},
    pendingPreKey: { signedKeyId: 1, baseKey: openKey },
  };

  return { _sessions: sessions, version: "v1" };
}

function _buildEntry(keyStr, closed) {
  const entry = SessionRecord.createEntry();
  entry.registrationId = 100;
  entry.currentRatchet = {
    ephemeralKeyPair: {
      pubKey: Buffer.alloc(33, 1),
      privKey: Buffer.alloc(32, 1),
    },
    lastRemoteEphemeralKey: Buffer.alloc(33, 2),
    previousCounter: 0,
    rootKey: Buffer.alloc(32, 3),
  };
  entry.indexInfo = {
    baseKey: Buffer.from(keyStr),
    baseKeyType: 1,
    closed: closed,
    used: 1000,
    created: 1000,
    remoteIdentityKey: Buffer.alloc(33, 4),
  };
  return entry;
}

function _buildOpenEntry(keyStr) {
  return _buildEntry(keyStr, -1);
}

function _buildClosedEntry(keyStr, closedAt) {
  return _buildEntry(keyStr, closedAt || 1000);
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — deserialize");
// ---------------------------------------------------------------------------

test("deserializa sem lançar erro", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  assert.ok(record instanceof SessionRecord);
});

test("número correto de sessões após deserialize", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  assert.strictEqual(Object.keys(record.sessions).length, 3);
});

test("sessão aberta encontrada via getOpenSession()", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const open = record.getOpenSession();
  assert.ok(open, "deveria haver sessão aberta");
  assert.strictEqual(open.indexInfo.closed, -1);
});

test("haveOpenSession() retorna true", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  assert.strictEqual(record.haveOpenSession(), true);
});

test("registro inconsistente com múltiplas abertas mantém getOpenSession funcional", () => {
  const data = buildFixture(5);
  data._sessions["open_session_2"] = {
    registrationId: 188,
    currentRatchet: {
      ephemeralKeyPair: {
        pubKey: Buffer.alloc(33, 7).toString("base64"),
        privKey: Buffer.alloc(32, 7).toString("base64"),
      },
      lastRemoteEphemeralKey: Buffer.alloc(33, 1).toString("base64"),
      previousCounter: 0,
      rootKey: Buffer.alloc(32, 2).toString("base64"),
    },
    indexInfo: {
      baseKey: "open_session_2",
      baseKeyType: 1,
      closed: -1,
      used: 9999998,
      created: 9999998,
      remoteIdentityKey: Buffer.alloc(33, 3).toString("base64"),
    },
    _chains: {},
    pendingPreKey: { signedKeyId: 1, baseKey: "open_session_2" },
  };

  const record = SessionRecord.deserialize(data);
  const open = record.getOpenSession();
  assert.ok(open, "deveria haver sessão aberta");
  assert.ok(
    open instanceof SessionRecord.SessionEntry,
    "getOpenSession deve sempre retornar SessionEntry materializada"
  );
});

test("buffers são Buffer (não string) após deserialize", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const open = record.getOpenSession();
  assert.ok(Buffer.isBuffer(open.indexInfo.baseKey));
  assert.ok(Buffer.isBuffer(open.currentRatchet.rootKey));
  assert.ok(Buffer.isBuffer(open.indexInfo.remoteIdentityKey));
});

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — serialize / round-trip");
// ---------------------------------------------------------------------------

test("serialize produz objeto com _sessions e version", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const out = record.serialize();
  assert.ok(out._sessions);
  assert.strictEqual(out.version, "v1");
});

test("round-trip preserva número de sessões", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const record2 = SessionRecord.deserialize(record.serialize());
  assert.strictEqual(
    Object.keys(record2.sessions).length,
    Object.keys(record.sessions).length
  );
});

test("round-trip preserva closed=-1 na sessão aberta", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const record2 = SessionRecord.deserialize(record.serialize());
  const open = record2.getOpenSession();
  assert.ok(open);
  assert.strictEqual(open.indexInfo.closed, -1);
});

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — removeOldSessions");
// ---------------------------------------------------------------------------

test("não remove nada quando total <= CLOSED_SESSIONS_MAX (40)", () => {
  const data = buildFixture(39); // 39 fechadas + 1 aberta = 40
  const record = SessionRecord.deserialize(data);
  record.removeOldSessions();
  assert.strictEqual(Object.keys(record.sessions).length, 40);
});

test("remove exatamente 1 sessão quando total = 41", () => {
  const data = buildFixture(40); // 40 fechadas + 1 aberta = 41
  const record = SessionRecord.deserialize(data);
  record.removeOldSessions();
  assert.strictEqual(Object.keys(record.sessions).length, 40);
});

test("remove a sessão fechada MAIS ANTIGA", () => {
  const data = buildFixture(40); // closed timestamps: 1000000, 1001000, ...
  const record = SessionRecord.deserialize(data);
  record.removeOldSessions();
  // closed_session_0 tem o menor timestamp → deve ser removida
  assert.ok(!record.sessions["closed_session_0"], "sessão mais antiga deve ter sido removida");
  assert.ok(record.sessions["closed_session_1"], "segunda sessão deve permanecer");
});

test("nunca remove a sessão aberta", () => {
  const data = buildFixture(40);
  const record = SessionRecord.deserialize(data);
  record.removeOldSessions();
  assert.ok(record.sessions["open_session"], "sessão aberta deve permanecer");
  assert.ok(record.getOpenSession(), "getOpenSession() ainda deve retornar sessão");
});

test("lança erro se não houver sessões fechadas para remover", () => {
  // Cria record com 41 sessões todas abertas (situação corrompida)
  const record = new SessionRecord();
  for (let i = 0; i < 41; i++) {
    const entry = SessionRecord.createEntry();
    entry.registrationId = 100;
    entry.currentRatchet = {
      ephemeralKeyPair: {
        pubKey: Buffer.alloc(33, i),
        privKey: Buffer.alloc(32, i),
      },
      lastRemoteEphemeralKey: Buffer.alloc(33, 1),
      previousCounter: 0,
      rootKey: Buffer.alloc(32, 2),
    };
    entry.indexInfo = {
      baseKey: Buffer.from(`key_${i}`),
      baseKeyType: 1,
      closed: -1, // todas abertas
      used: i,
      created: i,
      remoteIdentityKey: Buffer.alloc(33, 3),
    };
    record.sessions[`key_${i}`] = entry;
  }
  assert.throws(() => record.removeOldSessions(), /Corrupt sessions object/);
});

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — closeSession / openSession");
// ---------------------------------------------------------------------------

test("closeSession marca sessão como fechada", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const open = record.getOpenSession();
  record.closeSession(open);
  assert.notStrictEqual(open.indexInfo.closed, -1);
  assert.ok(open.indexInfo.closed > 0);
});

test("openSession reabre sessão fechada", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const open = record.getOpenSession();
  record.closeSession(open);
  record.openSession(open);
  assert.strictEqual(open.indexInfo.closed, -1);
});

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — deleteAllSessions");
// ---------------------------------------------------------------------------

test("deleteAllSessions remove tudo", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  record.deleteAllSessions();
  assert.strictEqual(Object.keys(record.sessions).length, 0);
  assert.strictEqual(record.getOpenSession(), undefined);
});

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — _openSessionCache (população)");
// ---------------------------------------------------------------------------

test("getOpenSession() popula o cache na primeira chamada", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  record._openSessionCache = null;
  assert.strictEqual(record._openSessionCache, null);
  const session = record.getOpenSession();
  assert.ok(session);
  assert.strictEqual(record._openSessionCache, session);
});

test("getOpenSession() retorna a mesma referência (cache hit)", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const first = record.getOpenSession();
  const second = record.getOpenSession();
  assert.strictEqual(first, second);
});

test("setSession() preenche o cache quando a sessão está aberta", () => {
  const record = new SessionRecord();
  const entry = _buildOpenEntry("open_key");
  record.setSession(entry);
  assert.strictEqual(record._openSessionCache, entry);
});

test("setSession() altera o cache quando a sessão está fechada, mas foi usada recentemente", () => {
  const record = new SessionRecord();
  const entry = _buildClosedEntry("closed_key", 1000);
  record.setSession(entry);
  assert.strictEqual(record._openSessionCache, entry);
});

test("openSession() preenche o cache", () => {
  const record = new SessionRecord();
  const entry = _buildClosedEntry("some_key", 1000);
  record.sessions[Buffer.from("some_key").toString("base64")] = entry;
  record.openSession(entry);
  assert.strictEqual(record._openSessionCache, entry);
});

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — _openSessionCache (deleção)");
// ---------------------------------------------------------------------------

test("closeSession() limpa o cache quando a sessão fechada é a cacheada", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const open = record.getOpenSession();
  assert.strictEqual(record._openSessionCache, open);
  record.closeSession(open);
  assert.strictEqual(record._openSessionCache, null);
});

test("closeSession() NÃO limpa o cache ao fechar uma sessão diferente", () => {
  const record = new SessionRecord();
  const openEntry = _buildOpenEntry("open_key");
  const otherEntry = _buildOpenEntry("other_key");
  record.setSession(openEntry);
  record.sessions[Buffer.from("other_key").toString("base64")] = otherEntry;
  record._openSessionCache = openEntry;
  record.closeSession(otherEntry);
  assert.strictEqual(record._openSessionCache, openEntry);
});

test("deleteAllSessions() limpa o cache", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  record.getOpenSession();
  assert.ok(record._openSessionCache);
  record.deleteAllSessions();
  assert.strictEqual(record._openSessionCache, null);
});

test("removeOldSessions() limpa o cache se a sessão removida era a cacheada", () => {
  const record = new SessionRecord();
  for (let i = 0; i < 40; i++) {
    const entry = _buildClosedEntry(`closed_${i}`, 1000 + i * 1000);
    record.sessions[`closed_${i}`] = entry;
  }
  const openEntry = _buildOpenEntry("open_key");
  record.setSession(openEntry);
  // Força o cache a apontar para a sessão mais antiga (situação defensiva)
  const oldestEntry = record.sessions["closed_0"];
  record._openSessionCache = oldestEntry;
  record.removeOldSessions();
  assert.ok(!record.sessions["closed_0"]);
  assert.strictEqual(record._openSessionCache, null);
});

test("removeOldSessions() NÃO limpa o cache quando a sessão removida não é a cacheada", () => {
  const record = new SessionRecord();
  for (let i = 0; i < 40; i++) {
    const entry = _buildClosedEntry(`closed_${i}`, 1000 + i * 1000);
    record.sessions[`closed_${i}`] = entry;
  }
  const openEntry = _buildOpenEntry("open_key");
  record.setSession(openEntry);
  assert.strictEqual(record._openSessionCache, openEntry);
  record.removeOldSessions();
  assert.strictEqual(record._openSessionCache, openEntry);
});

// ---------------------------------------------------------------------------
console.log("\nSessionRecord — _openSessionCache (reatribuição)");
// ---------------------------------------------------------------------------

test("getOpenSession() encontra nova sessão após cache limpo por closeSession()", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const open = record.getOpenSession();
  record.closeSession(open);
  assert.strictEqual(record._openSessionCache, null);
  const newEntry = _buildOpenEntry("new_open_key");
  record.setSession(newEntry);
  const found = record.getOpenSession();
  assert.strictEqual(found, newEntry);
  assert.strictEqual(record._openSessionCache, newEntry);
});

test("setSession() reatribui o cache ao inserir nova sessão aberta", () => {
  const record = SessionRecord.deserialize(FIXTURE);
  const firstOpen = record.getOpenSession();
  const newEntry = _buildOpenEntry("new_key");
  record.setSession(newEntry);
  assert.strictEqual(record._openSessionCache, newEntry);
  assert.notStrictEqual(record._openSessionCache, firstOpen);
});

test("openSession() reatribui o cache para uma sessão diferente", () => {
  const record = new SessionRecord();
  const entry1 = _buildOpenEntry("key1");
  const entry2 = _buildClosedEntry("key2", 1000);
  record.setSession(entry1);
  record.sessions[Buffer.from("key2").toString("base64")] = entry2;
  assert.strictEqual(record._openSessionCache, entry1);
  record.openSession(entry2);
  assert.strictEqual(record._openSessionCache, entry2);
  assert.notStrictEqual(record._openSessionCache, entry1);
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
