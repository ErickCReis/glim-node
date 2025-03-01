import { appendFile } from "node:fs/promises";

type LogObject = {
  severity: "TRACE" | "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  timestamp: string;
  "trace-id": string;
  appname: string;
  env: string;
  message: string;
};

export type LogObjectReq = LogObject & {
  req: {
    method: string;
    url: string;
    host: string;
    remoteAddress: string;
    remotePort: number;
  };
};

export type LogObjectRes = LogObject & {
  res: {
    statusCode: number;
  };
  responseTime: number;
};

export async function saveLog(log: LogObject) {
  await appendFile("./logs/main.log", `${JSON.stringify(log)}\n`);
}
