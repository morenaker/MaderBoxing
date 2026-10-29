import { getStore } from '@netlify/blobs';

// Úložiště dat administrace (Netlify Blobs).
// MB_MEMORY_STORE=1 → data jen v paměti, pro lokální testování.

const memory = new Map();

function memoryStore(name) {
    if (!memory.has(name)) memory.set(name, new Map());
    const data = memory.get(name);
    return {
        async get(key, options) {
            const value = data.get(key);
            if (value === undefined) return null;
            return options?.type === 'json' ? JSON.parse(value) : value;
        },
        async setJSON(key, value) {
            data.set(key, JSON.stringify(value));
        },
        async delete(key) {
            data.delete(key);
        },
        async list() {
            return { blobs: [...data.keys()].map((key) => ({ key })) };
        },
    };
}

export function store(name) {
    return process.env.MB_MEMORY_STORE ? memoryStore(name) : getStore({ name, consistency: 'strong' });
}

export async function listJSON(blobStore) {
    const { blobs } = await blobStore.list();
    const items = await Promise.all(blobs.map((blob) => blobStore.get(blob.key, { type: 'json' })));
    return items.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function newId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
