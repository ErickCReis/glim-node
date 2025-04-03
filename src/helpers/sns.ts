import {
  ListTopicsCommand,
  PublishCommand,
  SNSClient,
} from "@aws-sdk/client-sns";
import { z } from "zod";

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

  const listTopics = async () => {
    const response = await snsClient.send(new ListTopicsCommand({}));
    return response;
  };

  async function publish(topic: keyof typeof config.topics, message: string) {
    const command = new PublishCommand({
      TopicArn: config.topics[topic],
      Message: message,
    });

    await snsClient.send(command);
  }

  return {
    publish,
    listTopics,
  };
}

export function getSNSEnv(
  namespace?: string,
  alias = "default",
  topicNames: string[] = [],
) {
  const key = (
    namespace
      ? alias === "default"
        ? `NOTIFICATION_${namespace}`
        : `NOTIFICATION_${namespace}_${alias}`
      : alias === "default"
        ? "NOTIFICATION"
        : `NOTIFICATION_${alias}`
  )
    .toUpperCase()
    .replaceAll("-", "_");

  const snsEnv = z
    .object({
      [`${key}_REGION`]: z.string(),
      [`${key}_ENDPOINT`]: z.string().optional(),
      [`${key}_ACCESS_KEY`]: z.string(),
      [`${key}_SECRET_KEY`]: z.string(),

      ...topicNames.reduce(
        (acc, topic) => {
          acc[`${key}_TOPIC_${topic.replaceAll("-", "_").toUpperCase()}_ARN`] =
            z.string();
          return acc;
        },
        {} as Record<string, z.ZodTypeAny>,
      ),
    })
    .parse(process.env);

  const region = snsEnv[`${key}_REGION`] as string;
  const endpoint = snsEnv[`${key}_ENDPOINT`];
  const accessKeyId = snsEnv[`${key}_ACCESS_KEY`] as string;
  const secretAccessKey = snsEnv[`${key}_SECRET_KEY`] as string;
  const topics = topicNames.reduce(
    (acc, topic) => {
      acc[topic] = snsEnv[
        `${key}_TOPIC_${topic.replaceAll("-", "_").toUpperCase()}_ARN`
      ] as string;
      return acc;
    },
    {} as Record<string, string>,
  );

  return {
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    topics,
  };
}
