// Benchmark: getOpenSession + getSessions — linear scan vs cache
// Uso: node bench_session.js

const { bench, group, run, summary } = require("mitata");
const SessionRecord = require("./src/session_record");

// ─── helpers ────────────────────────────────────────────────────────────────

let keyCounter = 0;
function makeSession(closedAt = -1) {
  const key = Buffer.alloc(33, ++keyCounter & 0xff);
  const s = SessionRecord.createEntry();
  s.registrationId = 1;
  s.indexInfo = {
    baseKey: key,
    baseKeyType: 2,
    closed: closedAt,
    used: Date.now(),
    created: Date.now(),
    remoteIdentityKey: Buffer.alloc(33, 1),
  };
  s.currentRatchet = {
    ephemeralKeyPair: {
      pubKey: Buffer.alloc(33, 2),
      privKey: Buffer.alloc(32, 3),
    },
    lastRemoteEphemeralKey: Buffer.alloc(33, 4),
    previousCounter: 0,
    rootKey: Buffer.alloc(32, 5),
  };
  s._chains = {};
  return s;
}

// Versão SEM cache (loop puro, comportamento original)
function getOpenSessionLinear(record) {
  for (const key in record.sessions) {
    const session = record.sessions[key];
    if (session.indexInfo.closed === -1) {
      return session;
    }
  }
}

function getOpenSessionLinearObjectValues(record) {
  for (const session of Object.values(record.sessions)) {
    if (session.indexInfo.closed === -1) {
      return session;
    }
  }
}

// ─── setup ──────────────────────────────────────────────────────────────────

const CLOSED_COUNT = 39; // pior caso: a sessão aberta é a última

function buildRecord(closedCount) {
  const record = new SessionRecord();
  for (let i = 0; i < closedCount; i++) {
    const s = makeSession(Date.now() - (closedCount - i) * 1000);
    record.setSession(s);
  }
  // sessão aberta por último (pior caso para o scan)
  const open = makeSession(-1);
  record.setSession(open);
  return record;
}

// ─── getSessions helpers ─────────────────────────────────────────────────────

function getSessionsOriginal(record) {
  return Object.values(record.sessions).sort((a, b) => {
    const aUsed = a.indexInfo.used || 0;
    const bUsed = b.indexInfo.used || 0;
    return aUsed === bUsed ? 0 : aUsed < bUsed ? 1 : -1;
  });
}

function getSessionsOptimized(record) {
  const keys = Object.keys(record.sessions);
  const out = new Array(keys.length);
  for (let i = 0; i < keys.length; i++) {
    out[i] = record.sessions[keys[i]];
  }
  return out.sort((a, b) => {
    const aUsed = a.indexInfo.used || 0;
    const bUsed = b.indexInfo.used || 0;
    return aUsed === bUsed ? 0 : aUsed < bUsed ? 1 : -1;
  });
}

// ─── Map helpers ─────────────────────────────────────────────────────────────

// Constrói um Map equivalente ao record.sessions (chave string → session)
function buildMap(closedCount) {
  const map = new Map();
  for (let i = 0; i < closedCount; i++) {
    const s = makeSession(Date.now() - (closedCount - i) * 1000);
    map.set(s.indexInfo.baseKey.toString('base64'), s);
  }
  const open = makeSession(-1);
  map.set(open.indexInfo.baseKey.toString('base64'), open);
  return map;
}

// lookup por chave
function lookupObject(record, key) {
  return record.sessions[key];
}
function lookupMap(map, key) {
  return map.get(key);
}

// set
function setObject(record, session) {
  record.sessions[session.indexInfo.baseKey.toString('base64')] = session;
}
function setMap(map, session) {
  map.set(session.indexInfo.baseKey.toString('base64'), session);
}

// scan pior caso (sem cache)
function scanObject(record) {
  for (const key in record.sessions) {
    if (record.sessions[key].indexInfo.closed === -1) return record.sessions[key];
  }
}
function scanMap(map) {
  for (const session of map.values()) {
    if (session.indexInfo.closed === -1) return session;
  }
}

// getSessions (sort)
function getSessionsObject(record) {
  return Object.values(record.sessions).sort((a, b) => (b.indexInfo.used || 0) - (a.indexInfo.used || 0));
}
function getSessionsMap(map) {
  return Array.from(map.values()).sort((a, b) => (b.indexInfo.used || 0) - (a.indexInfo.used || 0));
}

// delete
function deleteObject(record, key) {
  delete record.sessions[key];
}
function deleteMap(map, key) {
  map.delete(key);
}

// ─── run ─────────────────────────────────────────────────────────────────────

const record = buildRecord(CLOSED_COUNT);
const map    = buildMap(CLOSED_COUNT);

// chave de uma sessão fechada qualquer (para lookup e delete bench)
const sampleKey = Object.keys(record.sessions)[0];
const sampleSession = makeSession(Date.now() - 9999);

group("getOpenSession — 39 fechadas + 1 aberta (pior caso)", () => {
  summary(() => {
    bench("for..in scan (sem cache)", () => getOpenSessionLinear(record));
    bench("Object.values scan (sem cache)", () => getOpenSessionLinearObjectValues(record));
    bench("cache _openSession", () => record.getOpenSession());
  });
});

group("getSessions — 40 sessões com sort", () => {
  summary(() => {
    bench("Object.values + sort (original)", () => getSessionsOriginal(record));
    bench("Object.keys + new Array + sort (otimizado)", () => getSessionsOptimized(record));
  });
});

group("Object vs Map — lookup por chave", () => {
  summary(() => {
    bench("plain object []", () => lookupObject(record, sampleKey));
    bench("Map .get()", () => lookupMap(map, sampleKey));
  });
});

group("Object vs Map — set", () => {
  summary(() => {
    bench("plain object []=", () => setObject(record, sampleSession));
    bench("Map .set()", () => setMap(map, sampleSession));
  });
});

group("Object vs Map — scan pior caso (sem cache)", () => {
  summary(() => {
    bench("plain object for..in", () => scanObject(record));
    bench("Map for..of .values()", () => scanMap(map));
  });
});

group("Object vs Map — getSessions com sort", () => {
  summary(() => {
    bench("plain object Object.values + sort", () => getSessionsObject(record));
    bench("Map Array.from + sort", () => getSessionsMap(map));
  });
});

group("Object vs Map — delete", () => {
  summary(() => {
    bench("plain object delete", () => deleteObject(record, sampleKey));
    bench("Map .delete()", () => deleteMap(map, sampleKey));
  });
});

run();
