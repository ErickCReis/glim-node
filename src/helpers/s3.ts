import {
  GetObjectCommand,
  ListBucketsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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
