import {
  GetObjectCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";

export type S3 = ReturnType<typeof createS3Client>;

export function createS3Client(config: {
  region: string;
  endpoint?: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}) {
  const s3Client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  async function listBuckets() {
    const command = new ListBucketsCommand({
      BucketRegion: config.region,
    });

    const { Buckets } = await s3Client.send(command);
    return Buckets;
  }

  async function getObject(key: string) {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const { Body } = await s3Client.send(command);
    return Body?.transformToString();
  }

  return {
    listBuckets,
    getObject,
  };
}

export function getS3Env(namespace?: string, alias = "default") {
  const aliasWithoutPrefix = alias
    .toLocaleLowerCase()
    .replaceAll(/storage[-_]?/g, "");

  const key = (
    namespace
      ? alias === "default"
        ? `STORAGE_${namespace}`
        : `STORAGE_${namespace}_${aliasWithoutPrefix}`
      : alias === "default"
        ? "STORAGE"
        : `STORAGE_${aliasWithoutPrefix}`
  )
    .toUpperCase()
    .replaceAll("-", "_");
  const s3Env = z
    .object({
      [`${key}_REGION`]: z.string(),
      [`${key}_BUCKET`]: z.string(),
      [`${key}_ENDPOINT`]: z.string().optional(),
      [`${key}_ACCESS_KEY`]: z.string(),
      [`${key}_SECRET_KEY`]: z.string(),
    })
    .parse(process.env);

  const region = s3Env[`${key}_REGION`] as string;
  const bucket = s3Env[`${key}_BUCKET`] as string;
  const endpoint = s3Env[`${key}_ENDPOINT`];
  const accessKeyId = s3Env[`${key}_ACCESS_KEY`] as string;
  const secretAccessKey = s3Env[`${key}_SECRET_KEY`] as string;

  return {
    region,
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
  };
}
