import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'mygpt_db';
const STORE_MESSAGES = 'messages';
const STORE_SESSIONS = 'sessions';
const DB_VERSION = 2; // Incremented version for new store

export interface Message {
    id?: number;
    sessionId: number;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export interface ChatSession {
    id?: number;
    title: string;
    timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export const getDB = () => {
    if (typeof window === 'undefined') return null;
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
                    const store = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('sessionId', 'sessionId');
                } else if (oldVersion < 2) {
                    // If messages store already exists but we need the index
                    const store = transaction.objectStore(STORE_MESSAGES);
                    if (!store.indexNames.contains('sessionId')) {
                        store.createIndex('sessionId', 'sessionId');
                    }
                }

                if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
                    db.createObjectStore(STORE_SESSIONS, { keyPath: 'id', autoIncrement: true });
                }
            },
        });
    }
    return dbPromise;
};

// Message Functions
export const saveMessage = async (message: Omit<Message, 'id'>) => {
    const db = await getDB();
    if (!db) return;
    return db.add(STORE_MESSAGES, message as Message);
};

export const getSessionMessages = async (sessionId: number): Promise<Message[]> => {
    const db = await getDB();
    if (!db) return [];
    return db.getAllFromIndex(STORE_MESSAGES, 'sessionId', sessionId);
};

// Session Functions
export const createSession = async (title: string = 'New Chat'): Promise<number> => {
    const db = await getDB();
    if (!db) return -1;
    const id = await db.add(STORE_SESSIONS, { title, timestamp: Date.now() });
    return id as number;
};

export const getAllSessions = async (): Promise<ChatSession[]> => {
    const db = await getDB();
    if (!db) return [];
    return (await db.getAll(STORE_SESSIONS)).sort((a, b) => b.timestamp - a.timestamp);
};

export const deleteSession = async (sessionId: number) => {
    const db = await getDB();
    if (!db) return;
    const tx = db.transaction([STORE_SESSIONS, STORE_MESSAGES], 'readwrite');
    await tx.objectStore(STORE_SESSIONS).delete(sessionId);
    // Delete all messages associated with this session
    const messages = await tx.objectStore(STORE_MESSAGES).index('sessionId').getAllKeys(sessionId);
    await Promise.all(messages.map(key => tx.objectStore(STORE_MESSAGES).delete(key as IDBValidKey)));
    await tx.done;
};

export const updateSessionTitle = async (sessionId: number, title: string) => {
    const db = await getDB();
    if (!db) return;
    const session = await db.get(STORE_SESSIONS, sessionId);
    if (session) {
        session.title = title;
        await db.put(STORE_SESSIONS, session);
    }
};

export const clearAllData = async () => {
    const db = await getDB();
    if (!db) return;
    await db.clear(STORE_MESSAGES);
    await db.clear(STORE_SESSIONS);
};
