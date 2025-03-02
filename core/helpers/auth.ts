type Data = {
  id: number;
  name: string;
  nickname: string;
  email: string;
};

export type Auth = typeof auth;

export const auth = {
  raw: null as string | null,
  data: null as Data | null,

  login(raw: string) {
    this.raw = raw;
    this.data = JSON.parse(atob(raw));
  },
  logout() {
    this.raw = null;
    this.data = null;
  },
  on() {
    return this.data !== null;
  },
  off() {
    return !this.on();
  },
  get<K extends keyof Data>(key: K) {
    return this.data?.[key] as Data[K] | undefined;
  },
};
