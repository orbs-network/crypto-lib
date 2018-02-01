import * as path from "path";
import * as shell from "shelljs";
import * as child_process from "child_process";
import { delay } from "bluebird";
import * as _  from "lodash";
import { grpc } from "orbs-common-library/src/grpc";

const ORBS_SERVICE_READY_WAIT_MS = process.env.ORBS_SERVICE_READY_WAIT_MS || 30000;

export class OrbsNode {
  services: OrbsService[];

  constructor(services: OrbsService[]) {
    this.services = services;
  }

  static loadFromPath(topologyPath: string, nodeName: string) {
    const nodePath = path.resolve(topologyPath, nodeName);

    const serviceDirs = shell.ls(nodePath).filter((fileName: string) => fileName !== "config");
    const services = serviceDirs.map((serviceDir: string) => new OrbsService(path.resolve(nodePath, serviceDir)));
    return new this(services);
  }

  async startAll(optsPerService: { [key: string]: {}} = {}) {
    return Promise.all(this.services.map(service => service.start(optsPerService[service.getProjectName()])));
  }

  stopAll() {
    for (const service of this.services) {
      try {
        service.stop();
      } catch (err) {
        console.log(`failed to stop service ${service.getProjectName()}. error: ${err}`);
      }
    }
  }

  getPublicApiClient() {
    const publicApiService = _.find(
      this.services, (service: OrbsService) => service.topology.project === "public-api-service-typescript");
    if (!publicApiService)
      throw "failed to find a public api service in the node";

    return grpc.publicApiClient({ endpoint: publicApiService.topology.endpoint });
  }
}

export class OrbsService {
  topologyPath: string;
  topology: any;
  process: any;

  constructor(topologyPath: string) {
      this.topologyPath = topologyPath;
      this.topology = require(this.topologyPath);
  }

  getProjectName(): string {
    return this.topology.project;
  }

  public async start(opts = {}) {
      if (this.process) {
          throw "already running";
      }
      this.process = this.run(opts);
      // TODO: wait by polling service state (not implemented yet in the server-side)
      await delay(ORBS_SERVICE_READY_WAIT_MS);
  }

  private run(opts = {}, streamStdout = true) {
      const projectPath = path.resolve(__dirname, "../../projects", this.topology.project);
      const absoluteTopologyPath = path.resolve(__dirname, this.topologyPath);
      const childProcess = child_process.exec(
          `node dist/index.js ${absoluteTopologyPath}`, {
              async: true,
              cwd: projectPath,
              env: {...process.env, ...opts, ...{NODE_ENV: "test"}}  // TODO: passing args in env var due a bug in nconf.argv used by the services
          });
      if (!childProcess) {
        throw "failed to run process";
      }
      if (streamStdout) {
          childProcess.stdout.on("data", console.log);
          childProcess.stderr.on("data", console.log);
      }
      this.process = childProcess;
      return childProcess;
  }

  public stop() {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
  }
}

export class OrbsTopology {
  nodes: OrbsNode[];

  constructor(nodes: OrbsNode[]) {
    this.nodes = nodes;
  }

  async startAll(optsPerService: { [key: string]: {}} = {}) {
    return Promise.all(this.nodes.map(node => node.startAll(optsPerService)));
  }

  stopAll() {
    for (const node of this.nodes) {
      node.stopAll();
    }
  }

  static loadFromPath(topologyPath: string) {
    const topologyAbsolutePath = path.resolve(__dirname, topologyPath);
    const nodeDirs = shell.ls(topologyAbsolutePath);
    const nodes = nodeDirs.map((nodeName: string) => OrbsNode.loadFromPath(topologyAbsolutePath, nodeName));
    return new this(nodes);
  }
}
