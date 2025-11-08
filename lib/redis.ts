import { Redis } from '@upstash/redis';

let client: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    client = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
} catch {}

// In-memory fallback (dev)
const mem = new Map<string, any>();

function memIncr(key: string) {
  const v = (mem.get(key) ?? 0) + 1;
  mem.set(key, v);
  return v;
}

export const redis = {
  raw: client,
  async incr(key: string){
    if (client) return (await client.incr(key)) as number;
    return memIncr(key);
  },
  async expire(key: string, seconds: number){
    if (client) return client.expire(key, seconds);
  },
  async sadd(key: string, member: string){
    if (client) return client.sadd(key, member);
    const set = mem.get(key) ?? new Set();
    set.add(member);
    mem.set(key, set);
  },
  async sismember(key: string, member: string){
    if (client) return client.sismember(key, member);
    const set = mem.get(key) as Set<string>|undefined;
    return set ? set.has(member) : false;
  },
  async lrange(key: string, start: number, end: number){
    if (client) return client.lrange<string[]>(key, start, end) as any;
    return ['seed-1','seed-2','seed-3'];
  },
  async lpop(key: string){
    if (client) return client.lpop<string>(key);
    const arr = mem.get(key) as string[]|undefined;
    if (!arr || !arr.length) return null;
    const id = arr.shift();
    mem.set(key, arr);
    return id!;
  },
  async rpush(key: string, ...values: string[]){
    if (client) return client.rpush(key, values);
    const arr = mem.get(key) as string[]|undefined ?? [];
    arr.push(...values);
    mem.set(key, arr);
  },
  async get(key: string){
    if (client) return client.get(key);
    return mem.get(key) ?? null;
  },
  async set(key: string, value: any, opts?: any){
    if (client) return (client as any).set(key, value, opts);
    mem.set(key, value);
  },
  pipeline(){
    if (client) return client.pipeline();
    // Basic noop shim for dev
    const ops: any[] = [];
    return {
      get: (k: string)=> ops.push(['get', k]),
      exec: async ()=> ops.map(()=>null),
    };
  }
};
