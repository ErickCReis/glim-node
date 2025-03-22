import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";

export type SNS = ReturnType<typeof createSNSClient>;

export function createSNSClient<
  Topics extends ReadonlyArray<string> | undefined,
>(config: {
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  topics: {
    [K in Topics extends ReadonlyArray<infer U> ? U : never]: string;
  };
}) {
  const snsClient = new SNSClient({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  async function publish(topic: keyof typeof config.topics, message: string) {
    const command = new PublishCommand({
      TopicArn: config.topics[topic],
      Message: message,
    });

    await snsClient.send(command);
  }

  return {
    publish,
  };
}
