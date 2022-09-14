import * as gcp from '@pulumi/gcp';
import * as k8s from '@pulumi/kubernetes';
import {Input} from '@pulumi/pulumi';
import {
  addLabelsToWorkers,
  config,
  createServiceAccountAndGrantRoles,
  createSubscriptionsFromWorkers, deployApplicationSuite,
  getImageTag,
  location, nodeOptions,
} from '@dailydotdev/pulumi-common';

const workers = require('./workers');

const imageTag = getImageTag();
const name = 'gateway';

// Provision Redis (Memorystore)
const redis = new gcp.redis.Instance(`${name}-redis`, {
  name: `${name}-redis`,
  tier: 'STANDARD_HA',
  memorySizeGb: 3,
  region: location,
  authEnabled: true,
  redisVersion: 'REDIS_6_X',
});

export const redisHost = redis.host;

const {serviceAccount} = createServiceAccountAndGrantRoles(
  `${name}-sa`,
  name,
  `daily-${name}`,
  [
    {name: 'profiler', role: 'roles/cloudprofiler.agent'},
    {name: 'trace', role: 'roles/cloudtrace.agent'},
    {name: 'secret', role: 'roles/secretmanager.secretAccessor'},
    {name: 'pubsub', role: 'roles/pubsub.editor'},
  ],
);

const image = `us.gcr.io/daily-ops/daily-${name}:${imageTag}`;

// Create K8S service account and assign it to a GCP service account
const {namespace} = config.requireObject<{ namespace: string }>('k8s');

const envVars: Record<string, Input<string>> = {
  ...config.requireObject<Record<string, string>>('env'),
  redisHost,
  redisPass: redis.authString,
  redisPort: redis.port.apply((port) => port.toString()),
};

const memory = 1024;
const limits: Input<{
  [key: string]: Input<string>;
}> = {
  cpu: '1',
  memory: `${memory}Mi`,
};

const bgLimits: Input<{
  [key: string]: Input<string>;
}> = {cpu: '1', memory: '256Mi'};

const probe: k8s.types.input.core.v1.Probe = {
  httpGet: {path: '/health', port: 'http'},
  initialDelaySeconds: 5,
};

const topics = ['features-reset', 'username-changed'].map(
  (topic) => new gcp.pubsub.Topic(topic, {name: topic}),
);

createSubscriptionsFromWorkers(
  name,
  addLabelsToWorkers(workers, {app: name}),
  {dependsOn: topics},
);

deployApplicationSuite({
  name,
  namespace,
  image,
  imageTag,
  serviceAccount,
  secrets: envVars,
  migration: {
    args: ['yarn', 'run', 'db:migrate:latest']
  },
  apps: [{
    port: 3000,
    env: [nodeOptions(memory)],
    maxReplicas: 10,
    limits,
    readinessProbe: probe,
    metric: {type: 'memory_cpu', cpu: 70},
    createService: true,
  }, {
    nameSuffix: 'bg',
    env: [{name: 'MODE', value: 'background'}],
    maxReplicas: 10,
    limits: bgLimits,
    metric: {type: 'pubsub', labels: {app: name}, targetAverageValue: 20},
  }]
})
