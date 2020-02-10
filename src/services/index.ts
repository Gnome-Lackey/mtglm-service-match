import { AttributeMap } from "aws-sdk/clients/dynamodb";

import { MTGLMDynamoClient } from "mtglm-service-sdk/build/clients/dynamo";

import * as matchMapper from "mtglm-service-sdk/build/mappers/match";
import * as recordMapper from "mtglm-service-sdk/build/mappers/record";
import * as seasonMapper from "mtglm-service-sdk/build/mappers/season";

import { SuccessResponse, MatchResponse } from "mtglm-service-sdk/build/models/Responses";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";

import {
  PROPERTIES_RECORD,
  PROPERTIES_MATCH,
  PROPERTIES_PLAYER,
  PROPERTIES_SEASON_METADATA
} from "mtglm-service-sdk/build/constants/mutable_properties";
import { RecordDynamoCreateItem } from "mtglm-service-sdk/build/models/Items";

const { MATCH_TABLE_NAME, PLAYER_TABLE_NAME, RECORD_TABLE_NAME, SEASON_TABLE_NAME } = process.env;

const matchClient = new MTGLMDynamoClient(MATCH_TABLE_NAME, PROPERTIES_MATCH);
const recordClient = new MTGLMDynamoClient(RECORD_TABLE_NAME, PROPERTIES_RECORD);
const playerClient = new MTGLMDynamoClient(PLAYER_TABLE_NAME, PROPERTIES_PLAYER);
const seasonMetadataClient = new MTGLMDynamoClient(SEASON_TABLE_NAME, PROPERTIES_SEASON_METADATA);

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

const updatePlayerRecord = async (records: RecordDynamoCreateItem[]): Promise<AttributeMap[]> =>
  await Promise.all(
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

      const playerRecordUpdate = {
        totalMatchWins: totalWins,
        totalMatchLosses: totalLosses
      };

      return playerClient.update({ playerId: player.playerId as string }, playerRecordUpdate);
    })
  );

const updateSeasonMetadata = async (
  seasonId: string,
  records: RecordDynamoCreateItem[]
): Promise<AttributeMap[]> => {
  if (records.length !== 2) {
    return null;
  }

  const playerA = records[0];
  const playerB = records[1];
  const metadataKeys = records.map((record) => ({ seasonId, playerId: record.playerId }));

  const metadataResults = await seasonMetadataClient.fetchByKeys(metadataKeys);

  const [metadataNodeA, metadataNodeB] = metadataResults.map(seasonMapper.toMetadataNode);

  const isPlayerAWinner = playerA.wins > playerB.wins;
  const isSeasonMatch = metadataNodeA.playedOpponentIds.includes(metadataNodeB.playerId);

  await seasonMetadataClient.update(
    { playerId: playerA.playerId, seasonId },
    {
      seasonWins: isSeasonMatch && isPlayerAWinner ? metadataNodeA.seasonWins + 1 : metadataNodeA.seasonWins,
      seasonLosses: isSeasonMatch && !isPlayerAWinner ? metadataNodeA.seasonLosses + 1 : metadataNodeA.seasonLosses,
      totalWins: isPlayerAWinner ? metadataNodeA.totalWins + 1 : metadataNodeA.totalWins,
      totalLosses: isPlayerAWinner ? metadataNodeA.totalLosses : metadataNodeA.totalLosses + 1,
      playedOpponentIds: [...metadataNodeA.playedOpponentIds, playerB.playerId]
    }
  );

  await seasonMetadataClient.update(
    { playerId: playerB.playerId, seasonId },
    {
      seasonWins: isSeasonMatch && isPlayerAWinner ? metadataNodeB.seasonWins + 1 : metadataNodeB.seasonWins,
      seasonLosses: isSeasonMatch && !isPlayerAWinner ? metadataNodeB.seasonLosses + 1: metadataNodeB.seasonLosses,
      totalWins: isPlayerAWinner ? metadataNodeB.totalWins + 1 : metadataNodeB.totalWins,
      totalLosses: isPlayerAWinner ? metadataNodeB.totalLosses : metadataNodeB.totalLosses + 1,
      playedOpponentIds: [...metadataNodeB.playedOpponentIds, playerA.playerId]
    }
  );

  return null;
};

const createRecords = async (
  newMatchId: string,
  records: RecordDynamoCreateItem[]
): Promise<AttributeMap[]> =>
  await Promise.all(
    records.map(async (record) =>
      recordClient.create({ recordId: record.recordId, matchId: newMatchId }, record)
    )
  );

export const create = async (data: MatchCreateRequest): Promise<MatchResponse> => {
  const matchItem = matchMapper.toCreateItem(data);
  const records = data.records.map((playerRecord) =>
    recordMapper.toCreateItem(matchItem.matchId, playerRecord)
  );

  matchItem.playerRecords = records.map((record) => record.recordId);

  await updatePlayerRecord(records);
  await updateSeasonMetadata(matchItem.seasonId, records);

  const recordResults = await createRecords(matchItem.matchId, records);
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
