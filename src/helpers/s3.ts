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

    const response = await s3Client.send(command);

    return response.Buckets;
  }

  async function getObject(key: string) {
    const command = new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    // Handle the response.  For example, stream the body:
    // const bodyContents = await streamToString(response.Body);
    return response;
  }

  return {
    listBuckets,
    getObject,
  };
}
