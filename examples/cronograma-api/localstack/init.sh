#!/bin/bash

awslocal s3api create-bucket --bucket $STORAGE_MS_CRONOGRAMA_CONSTRUCAO_BUCKET

TOPIC_PARTS=(${NOTIFICATION_MS_CRONOGRAMA_TOPIC_CRIACAO_CRONOGRAMA_ARN//:/ })
awslocal sns create-topic --name ${TOPIC_PARTS[-1]}