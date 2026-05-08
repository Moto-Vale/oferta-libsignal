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
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
