#!/bin/bash

awslocal s3api create-bucket --bucket $STORAGE_MS_TASK_CONSTRUCAO_BUCKET

TOPIC_PARTS=(${NOTIFICATION_MS_TASK_TOPIC_CRIACAO_TASK_ARN//:/ })
awslocal sns create-topic --name ${TOPIC_PARTS[-1]}