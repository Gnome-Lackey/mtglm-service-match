import { AttributeMap } from "aws-sdk/clients/dynamodb";

import { MTGLMDynamoClient } from "mtglm-service-sdk/build/clients/dynamo";

import * as matchMapper from "mtglm-service-sdk/build/mappers/match";
import * as recordMapper from "mtglm-service-sdk/build/mappers/record";

import { SuccessResponse, MatchResponse } from "mtglm-service-sdk/build/models/Responses";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";

import {
  PROPERTIES_RECORD,
  PROPERTIES_MATCH,
  PROPERTIES_PLAYER
} from "mtglm-service-sdk/build/constants/mutable_properties";

const { MATCH_TABLE_NAME, PLAYER_TABLE_NAME, RECORD_TABLE_NAME } = process.env;

const matchClient = new MTGLMDynamoClient(MATCH_TABLE_NAME, PROPERTIES_MATCH);
const recordClient = new MTGLMDynamoClient(RECORD_TABLE_NAME, PROPERTIES_RECORD);
const playerClient = new MTGLMDynamoClient(PLAYER_TABLE_NAME, PROPERTIES_PLAYER);

const buildResponse = (
  match: AttributeMap,
  recordA: AttributeMap,
  recordB: AttributeMap
): MatchResponse => {
  const matchNode = matchMapper.toNode(match);
  const recordANode = recordMapper.toNode(recordA);
  const recordBNode = recordMapper.toNode(recordB);

  return {
    id: matchNode.matchId,
    playerARecord: {
      ...recordMapper.toView(recordANode),
      player: recordANode.playerId,
      match: matchNode.matchId
    },
    playerBRecord: {
      ...recordMapper.toView(recordBNode),
      player: recordBNode.playerId,
      match: matchNode.matchId
    }
  };
};

export const create = async (data: MatchCreateRequest): Promise<MatchResponse> => {
  const matchItem = matchMapper.toCreateItem();
  const recordAItem = recordMapper.toCreateItem(matchItem.matchId, data.playerA);
  const recordBItem = recordMapper.toCreateItem(matchItem.matchId, data.playerB);

  const { matchId } = matchItem;
  const { playerId: recordAPlayerId, recordId: recordAId, wins: recordAWins } = recordAItem;
  const { playerId: recordBPlayerId, recordId: recordBId, wins: recordBWins } = recordBItem;

  const players = await Promise.all([
    playerClient.fetchByKey({ playerId: recordAPlayerId }),
    playerClient.fetchByKey({ playerId: recordBPlayerId })
  ]);

  console.log(JSON.stringify(players));

  const isPlayerAWinner = recordAWins > recordBWins;

  const playerARecordUpdate = {
    totalMatchWins: isPlayerAWinner
      ? (players[0].totalMatchWins as number) + 1
      : (players[0].totalMatchWins as number),
    totalMatchLosses: isPlayerAWinner
      ? (players[0].totalMatchLosses as number)
      : (players[0].totalMatchLosses as number) + 1
  };

  const playerBRecordUpdate = {
    totalMatchWins: isPlayerAWinner
      ? (players[1].totalMatchWins as number)
      : (players[1].totalMatchWins as number) + 1,
    totalMatchLosses: isPlayerAWinner
      ? (players[1].totalMatchLosses as number) + 1
      : (players[1].totalMatchLosses as number)
  };

  console.log(JSON.stringify(playerARecordUpdate));
  console.log(JSON.stringify(playerBRecordUpdate));

  matchItem.playerARecordId = recordAId;
  matchItem.playerBRecordId = recordBId;

  const promises = await Promise.all([
    matchClient.create({ matchId }, matchItem),
    recordClient.create({ recordId: recordAId, matchId }, recordAItem),
    recordClient.create({ recordId: recordBId, matchId }, recordBItem),
    playerClient.update({ playerId: recordAPlayerId }, playerARecordUpdate),
    playerClient.update({ playerId: recordBPlayerId }, playerBRecordUpdate)
  ]);

  console.log(JSON.stringify(promises));

  return buildResponse(promises[0], promises[1], promises[2]);
};

export const get = async (matchId: string): Promise<MatchResponse> => {
  const matchResult = await matchClient.fetchByKey({ matchId });
  const recordAResults = await recordClient.fetchByKeys([
    { recordId: matchResult.matchARecordId as string, matchId },
    { recordId: matchResult.matchARecordId as string, matchId }
  ]);

  return buildResponse(matchResult, recordAResults[0], recordAResults[1]);
};

export const remove = async (matchId: string): Promise<SuccessResponse> => {
  const matchResult = await matchClient.fetchByKey({ matchId });

  await recordClient.remove({ recordId: matchResult.matchARecordId as string, matchId });
  await recordClient.remove({ recordId: matchResult.matchBRecordId as string, matchId });
  await matchClient.remove({ matchId });

  return { message: "Successfully deleted match." };
};
