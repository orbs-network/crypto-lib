import * as gaggle from "gaggle";
import { EventEmitter } from "events";

import { logger } from "../common-library/logger";
import { types } from "../common-library/types";
import BlockBuilder from "./block-builder";
import { RaftConsensusConfig, BaseConsensus } from "./base-consensus";

import { Gossip } from "../gossip";
import { Block } from "web3/types";
import { JsonBuffer, BlockUtils } from "../common-library";

// An RPC adapter to use with Gaggle's channels. We're using this adapter in order to implement the transport layer,
// for using Gaggle's "custom" channel (which we've extended ourselves).
class RPCConnector extends EventEmitter {
  private id: string;
  private gossip: types.GossipClient;

  public constructor(id: string, gossip: types.GossipClient) {
    super();

    this.id = id;
    this.gossip = gossip;
  }

  public connect(): void {
  }

  public disconnect(): void {
  }

  public received(originNodeId: string, message: any): void {
    // Propagate broadcast messages or unicast messages from other nodes.
    if (message.to === undefined || message.to === this.id) {
      this.emit("received", originNodeId, message);
    }
  }

  public broadcast(data: any): void {
    logger.debug(`Raft message multicast packet size: `, new Buffer(JSON.stringify(data)).length);
    logger.debug(`Raft broadcast message: ${JSON.stringify(data)}`);

    this.gossip.broadcastMessage({
      broadcastGroup: "consensus",
      messageType: "RaftMessage",
      buffer: new Buffer(JSON.stringify(data)),
      immediate: true
    });
  }

  public send(nodeId: string, data: any): void {
    logger.debug(`Raft message unicast packet size: `, new Buffer(JSON.stringify(data)).length);
    logger.debug(`Raft unicast message: ${JSON.stringify(data)}`);

    this.gossip.unicastMessage({
      recipient: nodeId,
      broadcastGroup: "consensus",
      messageType: "RaftMessage",
      buffer: new Buffer(JSON.stringify(data)),
      immediate: true
    });
  }
}

export interface ElectionTimeoutConfig {
  min: number;
  max: number;
}

export class RaftConsensus extends BaseConsensus {
  private transactionPool: types.TransactionPoolClient;
  private blockBuilder: BlockBuilder;

  private connector: RPCConnector;
  private node: any;
  private nextBlockChainIndex: number; // maintain consistency between gaggle log and storage

  public constructor(
    config: RaftConsensusConfig,
    gossip: types.GossipClient,
    blockStorage: types.BlockStorageClient,
    transactionPool: types.TransactionPoolClient,
    virtualMachine: types.VirtualMachineClient
  ) {
    super();
    logger.info(`Starting raft consensus with configuration: ${JSON.stringify(config)}`);
    this.connector = new RPCConnector(config.nodeName, gossip);
    this.transactionPool = transactionPool;
    this.blockBuilder = new BlockBuilder({
      virtualMachine, transactionPool, blockStorage,
      newBlockBuildCallback: (block) => this.onNewBlockBuild(block),
      pollIntervalMs: config.blockBuilderPollInterval,
      blockSizeLimit: config.blockSizeLimit
    });
    this.nextBlockChainIndex = 0;
    this.node = gaggle({
      id: config.nodeName,
      clusterSize: config.clusterSize,
      channel: {
        name: "custom",
        connector: this.connector
      },
      msgLimit: config.msgLimit,

      // How long to wait before declaring the leader dead?
      electionTimeout: {
        min: config.electionTimeout.min,
        max: config.electionTimeout.max,
      },

      // How often should the leader send heartbeats?
      heartbeatInterval: config.heartbeatInterval
    });

    // Nodes will emit "committed" events whenever the cluster comes to consensus about an entry.
    //
    // Note: we might consider adding transactions as the result to the "appended" event, which will require further
    // synchronization, but will make everything a wee bit faster.

    this.node.on("committed", async (data: any, index: number) => this.onCommitted(data, index));

    this.node.on("leaderElected", () => this.onLeaderElected());

  }

  private async onCommitted(data: any, index: number) {
    const msg: types.ConsensusMessage = data.data;

    // Since we're currently storing single transactions per-block, we'd increase the block numbers for every
    // committed entry.
    const start = new Date().getTime();
    const block: types.Block = JsonBuffer.parseJsonWithBuffers(JSON.stringify(msg.block));
    const end = new Date().getTime();

    const blockHash = BlockUtils.calculateBlockHash(block).toString("hex");

    logger.debug(`onCommitted ${this.node.id}: New block with height ${block.header.height} and hash ${blockHash} is about to be committed (RAFT index ${index})`);

    logger.info(`Finished deserializing block with height ${block.header.height} and hash ${blockHash} in ${end - start} ms`);

    logger.info(`New block to be committed with height ${block.header.height} and hash ${blockHash}`);

    try {
      await this.blockBuilder.commitBlock(block);
      if (this.node.isLeader()) {
        if (this.node.getCommitIndex() == index)
            this.blockBuilder.appendNextBlock();
      }
    } catch (err) {
      // Gad: if for any reason the commit flow (block storage + transaction pool) failed
      //  TODO: note: we maintain a sync routine with the raft log to try and update the storage state...
      logger.error(err);
      logger.error(`Failed to commit block with height ${block.header.height} and hash ${blockHash}: ${JSON.stringify(err)}`);
      // this.node.stepDown(); // -leader steps down (election time out will occur)
    }


  }


  private async onLeaderElected() {
    if (this.node.isLeader()) {
      logger.info(`Node ${this.node.id} was elected as a new leader!`);
      // const emptyBlock = BlockUtils.buildNextBlock(
      //   {
      //     transactions: [],
      //     transactionReceipts: [],
      //     stateDiff: []
      //   });

      // const appendMessage: types.ConsensusMessage = { block: emptyBlock };
      // this.node.append(appendMessage);
      this.blockBuilder.appendNextBlock();
    }
  }

  async onMessageReceived(fromAddress: string, messageType: string, message: any): Promise<any> {
    switch (messageType) {
      case "RaftMessage": {
        this.connector.received(message.from, message.data);
      }
    }
  }

  public onNewBlockBuild(block: types.Block) {
    const appendMessage: types.ConsensusMessage = { block };

    const blockHash = BlockUtils.calculateBlockHash(block).toString("hex");

    logger.debug(`onNewBlockBuilds ${this.node.id}:  New block with height ${block.header.height} and hash ${blockHash} is about to be appended to RAFT log`);

    this.node.append(appendMessage);
  }

  async initialize(): Promise<any> {
    return this.blockBuilder.initialize();
  }

  async shutdown(): Promise<any> {
    await Promise.all([this.node.close(), this.blockBuilder.shutdown()]);
  }

  public isLeader() {
    return this.node.isLeader();
  }

  public getState() {
    return this.node._state;
  }

  public getLeader() {
    return this.node._leader;
  }

  public getTerm() {
    return this.node._currentTerm;
  }

  public getVotes() {
    return JSON.stringify(this.node._votes);
  }

  public getClusterSize() {
    return this.node._clusterSize;
  }

  public getElectionTimeout() {
    return this.node._timeout;
  }
}
