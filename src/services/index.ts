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
  PROPERTIES_SEASON_METADATA
} from "mtglm-service-sdk/build/constants/mutable_properties";
import { RecordDynamoCreateItem } from "mtglm-service-sdk/build/models/Items";

const { MATCH_TABLE_NAME, RECORD_TABLE_NAME, SEASON_METADATA_TABLE_NAME } = process.env;

const matchClient = new MTGLMDynamoClient(MATCH_TABLE_NAME, PROPERTIES_MATCH);
const recordClient = new MTGLMDynamoClient(RECORD_TABLE_NAME, PROPERTIES_RECORD);
const seasonMetadataClient = new MTGLMDynamoClient(
  SEASON_METADATA_TABLE_NAME,
  PROPERTIES_SEASON_METADATA
);

const buildResponse = (matchResult: AttributeMap, recordResults: AttributeMap[]): MatchResponse => {
  const matchNode = matchMapper.toNode(matchResult);
  const matchView = matchMapper.toView(matchNode);
  const recordNodes = recordResults.map(recordMapper.toNode);

  const totalGames = recordNodes.reduce((total, record) => total + record.wins, 0);

  return {
    ...matchView,
    season: matchNode.seasonId,
    players: recordNodes.map((recordNode) => ({
      ...recordMapper.toView(recordNode),
      losses: totalGames - recordNode.wins,
      player: recordNode.playerId,
      match: matchNode.matchId
    }))
  };
};

const updateSeasonMetadata = async (
  seasonId: string,
  records: RecordDynamoCreateItem[]
): Promise<AttributeMap[]> => {
  const metadataKeys = records.map((record) => ({ seasonId, playerId: record.playerId }));

  const metadataResults = await seasonMetadataClient.fetchByKeys(metadataKeys);

  if (!metadataResults.length) {
    throw new Error("Error getting metadata. Season id or player id is invalid.");
  }

  const metadataNodes = metadataResults.map(seasonMapper.toMetadataNode);

  return await Promise.all(
    metadataNodes.map((metadataNode) => {
      const {
        playerId,
        playedOpponentIds,
        seasonWins,
        seasonLosses,
        totalLosses,
        totalWins
      } = metadataNode;

      const player = records.find((record) => record.playerId === playerId);

      const isPlayerAWinner = records
        .filter((record) => record.playerId !== player.playerId)
        .every((record) => player.wins > record.wins);

      const isSeasonMatch = records.every((record) => !playedOpponentIds.includes(record.playerId));
      const isSeasonMatchWinner = isSeasonMatch && isPlayerAWinner;
      const isSeasonMatchLoser = isSeasonMatch && !isPlayerAWinner;
      const totalSeasonWins = isSeasonMatchWinner ? seasonWins + 1 : seasonWins;
      const totalSeasonLosses = isSeasonMatchLoser ? totalLosses + 1 : seasonLosses;
      const totalMatchWins = isPlayerAWinner ? totalWins + 1 : totalWins;
      const totalMatchLosses = isPlayerAWinner ? totalLosses : totalLosses + 1;

      const newPlayedOpponents = records
        .filter((record) => record.playerId !== player.playerId)
        .map((record) => record.playerId);

      return seasonMetadataClient.update(
        { playerId: player.playerId, seasonId },
        {
          seasonWins: totalSeasonWins,
          seasonLosses: totalSeasonLosses,
          totalWins: totalMatchWins,
          totalLosses: totalMatchLosses,
          playedOpponentIds: [...playedOpponentIds, ...newPlayedOpponents]
        }
      );
    })
  );
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
  const records = data.records.map((playerRecord) => recordMapper.toCreateItem(matchItem.matchId, playerRecord));
  const recordIds = records.map((record) => record.recordId);

  const matchSearchResult = await matchClient.query({
    recordIds,
    isSeasonPoint: true
  });

  matchItem.isSeasonPoint = !matchSearchResult.length;
  matchItem.playerRecords = recordIds;

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
