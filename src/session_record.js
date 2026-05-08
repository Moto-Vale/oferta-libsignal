// vim: ts=4:sw=4

const BaseKeyType = require("./base_key_type");

const CLOSED_SESSIONS_MAX = 40;
const SESSION_RECORD_VERSION = "v1";

function assertBuffer(value) {
  if (!Buffer.isBuffer(value)) {
    throw new TypeError("Buffer required");
  }
}

class SessionEntry {
  constructor() {
    this._chains = {};
  }

  toString() {
    const baseKey =
      this.indexInfo &&
      this.indexInfo.baseKey &&
      this.indexInfo.baseKey.toString("base64");
    return `<SessionEntry [baseKey=${baseKey}]>`;
  }

  inspect() {
    return this.toString();
  }

  addChain(key, value) {
    assertBuffer(key);
    const id = key.toString("base64");
    if (this._chains.hasOwnProperty(id)) {
      throw new Error("Overwrite attempt");
    }
    this._chains[id] = value;
  }

  getChain(key) {
    assertBuffer(key);
    return this._chains[key.toString("base64")];
  }

  deleteChain(key) {
    assertBuffer(key);
    const id = key.toString("base64");
    if (!this._chains.hasOwnProperty(id)) {
      throw new ReferenceError("Not Found");
    }
    delete this._chains[id];
  }

  *chains() {
    for (const [k, v] of Object.entries(this._chains)) {
      yield [Buffer.from(k, "base64"), v];
    }
  }

  serialize() {
    const data = {
      registrationId: this.registrationId,
      currentRatchet: {
        ephemeralKeyPair: {
          pubKey:
            this.currentRatchet.ephemeralKeyPair.pubKey.toString("base64"),
          privKey:
            this.currentRatchet.ephemeralKeyPair.privKey.toString("base64"),
        },
        lastRemoteEphemeralKey:
          this.currentRatchet.lastRemoteEphemeralKey.toString("base64"),
        previousCounter: this.currentRatchet.previousCounter,
        rootKey: this.currentRatchet.rootKey.toString("base64"),
      },
      indexInfo: {
        baseKey: this.indexInfo.baseKey.toString("base64"),
        baseKeyType: this.indexInfo.baseKeyType,
        closed: this.indexInfo.closed,
        used: this.indexInfo.used,
        created: this.indexInfo.created,
        remoteIdentityKey: this.indexInfo.remoteIdentityKey.toString("base64"),
      },
      _chains: this._serialize_chains(this._chains),
    };
    if (this.pendingPreKey) {
      data.pendingPreKey = Object.assign({}, this.pendingPreKey);
      data.pendingPreKey.baseKey =
        this.pendingPreKey.baseKey.toString("base64");
    }
    return data;
  }

  /**
   * @returns {SessionEntry}
   */
  static deserialize(data) {
    const obj = new this();
    obj.registrationId = data.registrationId;
    obj.currentRatchet = {
      ephemeralKeyPair: {
        pubKey: Buffer.from(
          data.currentRatchet.ephemeralKeyPair.pubKey,
          "base64",
        ),
        privKey: Buffer.from(
          data.currentRatchet.ephemeralKeyPair.privKey,
          "base64",
        ),
      },
      lastRemoteEphemeralKey: Buffer.from(
        data.currentRatchet.lastRemoteEphemeralKey,
        "base64",
      ),
      previousCounter: data.currentRatchet.previousCounter,
      rootKey: Buffer.from(data.currentRatchet.rootKey, "base64"),
    };
    obj.indexInfo = {
      baseKey: Buffer.from(data.indexInfo.baseKey, "base64"),
      baseKeyType: data.indexInfo.baseKeyType,
      closed: data.indexInfo.closed,
      used: data.indexInfo.used,
      created: data.indexInfo.created,
      remoteIdentityKey: Buffer.from(
        data.indexInfo.remoteIdentityKey,
        "base64",
      ),
    };
    obj._chains = this._deserialize_chains(data._chains);
    if (data.pendingPreKey) {
      obj.pendingPreKey = Object.assign({}, data.pendingPreKey);
      obj.pendingPreKey.baseKey = Buffer.from(
        data.pendingPreKey.baseKey,
        "base64",
      );
    }
    return obj;
  }

  _serialize_chains(chains) {
    const r = {};
    for (const key of Object.keys(chains)) {
      const c = chains[key];
      const messageKeys = {};
      for (const [idx, key] of Object.entries(c.messageKeys)) {
        messageKeys[idx] = key.toString("base64");
      }
      r[key] = {
        chainKey: {
          counter: c.chainKey.counter,
          key: c.chainKey.key && c.chainKey.key.toString("base64"),
        },
        chainType: c.chainType,
        messageKeys: messageKeys,
      };
    }
    return r;
  }

  static _deserialize_chains(chains_data) {
    const r = {};
    for (const key of Object.keys(chains_data)) {
      const c = chains_data[key];
      const messageKeys = {};
      for (const [idx, key] of Object.entries(c.messageKeys)) {
        messageKeys[idx] = Buffer.from(key, "base64");
      }
      r[key] = {
        chainKey: {
          counter: c.chainKey.counter,
          key: c.chainKey.key && Buffer.from(c.chainKey.key, "base64"),
        },
        chainType: c.chainType,
        messageKeys: messageKeys,
      };
    }
    return r;
  }
}

const migrations = [
  {
    version: "v1",
    migrate: function migrateV1(data) {
      const sessions = data._sessions;
      if (data.registrationId) {
        for (const key in sessions) {
          if (!sessions[key].registrationId) {
            sessions[key].registrationId = data.registrationId;
          }
        }
      } else {
        for (const key in sessions) {
          if (sessions[key].indexInfo.closed === -1) {
            console.error(
              "V1 session storage migration error: registrationId",
              data.registrationId,
              "for open session version",
              data.version,
            );
          }
        }
      }
    },
  },
];

class SessionRecord {
  static createEntry() {
    return new SessionEntry();
  }

  static migrate(data) {
    let run = data.version === undefined;
    for (let i = 0; i < migrations.length; ++i) {
      if (run) {
        console.info("Migrating session to:", migrations[i].version);
        migrations[i].migrate(data);
      } else if (migrations[i].version === data.version) {
        run = true;
      }
    }
    if (!run) {
      throw new Error("Error migrating SessionRecord");
    }
  }

  /**
   * @returns {SessionRecord}
   */
  static deserialize(data) {
    if (data.version !== SESSION_RECORD_VERSION) {
      this.migrate(data);
    }

    const obj = new this();
    obj.lastUsedSessionId = data.lastUsedSessionId || null;

    if (data._sessions) {
      const sessions = data._sessions;
      let closedEntries = null;
      let openEntryLoaded = false;

      for (const key of Object.keys(sessions)) {
        const entry = sessions[key];
        if (entry.indexInfo.closed === -1 && !openEntryLoaded) {
          obj.sessions[key] = SessionEntry.deserialize(entry);
          openEntryLoaded = true;
        } else {
          (closedEntries ??= []).push([entry.indexInfo.closed, key]);
        }
      }

      if (closedEntries !== null) {
        closedEntries.sort((a, b) => b[0] - a[0]);

        for (let i = 0; i < closedEntries.length; i++) {
          const key = closedEntries[i][1];
          const session = sessions[key];
          if (i < 2) {
            obj.sessions[key] = SessionEntry.deserialize(session);
          } else {
            obj.sessions[key] = session;
          }
        }
      }
    }

    return obj;
  }

  constructor() {
    this.sessions = {};
    this.version = SESSION_RECORD_VERSION;
    this.lastUsedSessionId = null;
    this._openSessionCache = null;
  }

  serialize() {
    const _sessions = {};
    for (const [key, entry] of Object.entries(this.sessions)) {
      if (entry instanceof SessionEntry) {
        _sessions[key] = entry.serialize();
      } else {
        _sessions[key] = entry;
      }
    }
    return {
      _sessions,
      lastUsedSessionId: this.lastUsedSessionId,
      version: this.version,
    };
  }

  haveOpenSession() {
    const openSession = this.getOpenSession();
    return !!openSession && typeof openSession.registrationId === "number";
  }

  _materializeSession(id) {
    let session = this.sessions[id];
    if (session && !(session instanceof SessionEntry)) {
      session = SessionEntry.deserialize(session);
      this.sessions[id] = session;
    }
    return session;
  }

  getSession(key) {
    assertBuffer(key);
    const id = key.toString("base64");
    const session = this._materializeSession(id);

    if (session && session.indexInfo.baseKeyType === BaseKeyType.OURS) {
      throw new Error("Tried to lookup a session using our basekey");
    }
    return session;
  }

  /**
   * @returns {SessionEntry|undefined} The open session, or undefined if there is no open session.
   */
  getOpenSession() {
    if (this._openSessionCache) {
      return this._openSessionCache;
    }

    if (this.lastUsedSessionId && this.sessions[this.lastUsedSessionId]) {
      const rawSession = this.sessions[this.lastUsedSessionId];
      if (!this.isClosed(rawSession)) {
        const session = this._materializeSession(this.lastUsedSessionId);
        this._openSessionCache = session;
        return session;
      }
    }

    for (const key in this.sessions) {
      const rawSession = this.sessions[key];
      if (!this.isClosed(rawSession)) {
        this.lastUsedSessionId = key;
        const session = this._materializeSession(key);
        this._openSessionCache = session;
        return session;
      }
    }
  }

  setSession(session) {
    const key = session.indexInfo.baseKey.toString("base64");
    this.sessions[key] = session;
    this.lastUsedSessionId = key;
    this._openSessionCache = session;
  }

  getSessions() {
    let arr = Object.values(this.sessions);

    // Return sessions ordered with most recently used first.
    arr.sort((a, b) => {
      const aUsed = a.indexInfo.used || 0;
      const bUsed = b.indexInfo.used || 0;
      return aUsed === bUsed ? 0 : aUsed < bUsed ? 1 : -1;
    });

    if (
      this.lastUsedSessionId &&
      this.sessions[this.lastUsedSessionId] &&
      !this.isClosed(this.sessions[this.lastUsedSessionId])
    ) {
      const openSession = this._materializeSession(this.lastUsedSessionId);
      arr = [openSession, ...arr.filter((s) => s !== openSession)];
    }

    return arr;
  }

  closeSession(session) {
    if (this.isClosed(session)) {
      return;
    }
    session.indexInfo.closed = Date.now();
    if (this._openSessionCache === session) {
      this._openSessionCache = null;
    }
  }

  openSession(session) {
    session.indexInfo.closed = -1;
    this.lastUsedSessionId = session.indexInfo.baseKey.toString("base64");
    this._openSessionCache = session;
  }

  isClosed(session) {
    return session.indexInfo.closed !== -1;
  }

  removeOldSessions() {
    while (Object.keys(this.sessions).length > CLOSED_SESSIONS_MAX) {
      let oldestKey;
      let oldestSession;
      for (const [key, session] of Object.entries(this.sessions)) {
        if (
          session.indexInfo.closed !== -1 &&
          (!oldestSession ||
            session.indexInfo.closed < oldestSession.indexInfo.closed)
        ) {
          oldestKey = key;
          oldestSession = session;
        }
      }

      if (this._openSessionCache === oldestSession) {
        this._openSessionCache = null;
      }

      if (oldestKey) {
        delete this.sessions[oldestKey];
      } else {
        throw new Error("Corrupt sessions object");
      }
    }
  }

  deleteAllSessions() {
    for (const key of Object.keys(this.sessions)) {
      delete this.sessions[key];
    }
    this.lastUsedSessionId = null;
    this._openSessionCache = null;
  }
}

module.exports = SessionRecord;
module.exports.SessionEntry = SessionEntry;
