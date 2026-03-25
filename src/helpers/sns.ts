import {
  ListTopicsCommand,
  PublishCommand,
  SNSClient,
  type ListTopicsCommandOutput,
} from "@aws-sdk/client-sns";
import { formatEnvKey } from "@core/helpers/utils";
import { z } from "zod";

type TopicName<Topics extends ReadonlyArray<string> | undefined> =
  Topics extends ReadonlyArray<infer Topic> ? Topic & string : never;

export type SNSConfig<Topics extends ReadonlyArray<string> | undefined> = {
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  topics: {
    [K in TopicName<Topics>]: string;
  };
};

export type SNS<Topics extends ReadonlyArray<string> | undefined = ReadonlyArray<string>> = {
  publish: (topic: TopicName<Topics>, message: string) => Promise<void>;
  listTopics: () => Promise<ListTopicsCommandOutput>;
};

export function createSNSClient<const Topics extends ReadonlyArray<string> | undefined>(
  config: SNSConfig<Topics>,
): SNS<Topics> {
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

export function getSNSEnv<const Topics extends ReadonlyArray<string> = ReadonlyArray<string>>(
  namespace?: string,
  alias = "default",
  topicNames: Topics = [] as unknown as Topics,
): SNSConfig<Topics> {
  const key = formatEnvKey("NOTIFICATION", namespace, alias);
  const snsEnv = z
    .object({
      [`${key}_REGION`]: z.string(),
      [`${key}_ENDPOINT`]: z.string().optional(),
      [`${key}_ACCESS_KEY`]: z.string(),
      [`${key}_SECRET_KEY`]: z.string(),

      ...topicNames.reduce(
        (acc, topic) => {
          acc[`${key}_TOPIC_${topic.replaceAll("-", "_").toUpperCase()}_ARN`] = z.string();
          return acc;
        },
        {} as Record<string, z.ZodTypeAny>,
      ),
    })
    .parse(process.env);

  const region = snsEnv[`${key}_REGION`] as string;
  const endpoint = snsEnv[`${key}_ENDPOINT`] as string | undefined;
  const accessKeyId = snsEnv[`${key}_ACCESS_KEY`] as string;
  const secretAccessKey = snsEnv[`${key}_SECRET_KEY`] as string;
  const topics = topicNames.reduce(
    (acc, topic) => {
      const topicKey = topic as TopicName<Topics>;
      acc[topicKey] = snsEnv[
        `${key}_TOPIC_${topic.replaceAll("-", "_").toUpperCase()}_ARN`
      ] as string;
      return acc;
    },
    {} as SNSConfig<Topics>["topics"],
  );

  return {
    region,
    endpoint,
    accessKeyId,
    secretAccessKey,
    topics,
  };
}
