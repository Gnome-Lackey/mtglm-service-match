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

const buildResponse = (matchResult: AttributeMap, recordResults: AttributeMap[]): MatchResponse => {
  const matchNode = matchMapper.toNode(matchResult);
  const recordNodes = recordResults.map(recordMapper.toNode);

  const totalGames = recordNodes.reduce((total, record) => total + record.wins, 0);

  return {
    id: matchNode.matchId,
    season: matchNode.seasonId,
    players: recordNodes.map((recordNode) => ({
      ...recordMapper.toView(recordNode),
      losses: totalGames - recordNode.wins,
      player: recordNode.playerId,
      match: matchNode.matchId
    }))
  };
};

export const create = async (data: MatchCreateRequest): Promise<MatchResponse> => {
  const matchItem = matchMapper.toCreateItem(data);

  const records = data.records.map((playerRecord) =>
    recordMapper.toCreateItem(matchItem.matchId, playerRecord)
  );

  matchItem.playerRecords = records.map((record) => record.recordId);

  const recordResults = await Promise.all(
    records.map(async (record) => {
      const player = await playerClient.fetchByKey({ playerId: record.playerId });

      const isWinner = records
        .filter((nextRecord) => nextRecord.playerId !== record.playerId)
        .every((nextRecord) => nextRecord.wins < record.wins);

      const totalWins = isWinner
        ? (player.totalMatchWins as number) + 1
        : (player.totalMatchWins as number);

      const totalLosses = isWinner
        ? (player.totalMatchLosses as number)
        : (player.totalMatchLosses as number) + 1;

      const matchIds = (player.matchIds as string[]) || [];

      const playerRecordUpdate = {
        totalMatchWins: totalWins,
        totalMatchLosses: totalLosses,
        matchIds: [...matchIds, matchItem.matchId]
      };

      playerClient.update({ playerId: player.playerId as string }, playerRecordUpdate);

      return recordClient.create({ recordId: record.recordId, matchId: matchItem.matchId }, record);
    })
  );

  const matchResult = await matchClient.create({ matchId: matchItem.matchId }, matchItem);

  return buildResponse(matchResult, recordResults);
};

export const get = async (matchId: string): Promise<MatchResponse> => {
  const matchResult = await matchClient.fetchByKey({ matchId });
  const matchRecords = matchResult.playerRecords as string[];
  const recordAResults = await recordClient.fetchByKeys(
    matchRecords.map((recordId) => ({ recordId, matchId }))
  );

  return buildResponse(matchResult, recordAResults);
};

export const remove = async (matchId: string): Promise<SuccessResponse> => {
  const matchResult = await matchClient.fetchByKey({ matchId });

  await recordClient.remove({ recordId: matchResult.matchARecordId as string, matchId });
  await recordClient.remove({ recordId: matchResult.matchBRecordId as string, matchId });
  await matchClient.remove({ matchId });

  return { message: "Successfully deleted match." };
};
