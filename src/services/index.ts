import { AttributeMap } from "aws-sdk/clients/dynamodb";

import { MTGLMDynamoClient } from "mtglm-service-sdk/build/clients/dynamo";

import * as matchMapper from "mtglm-service-sdk/build/mappers/match";
import * as seasonMapper from "mtglm-service-sdk/build/mappers/season";

import { SuccessResponse, MatchResponse } from "mtglm-service-sdk/build/models/Responses";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";

import {
  PROPERTIES_MATCH,
  PROPERTIES_SEASON_METADATA
} from "mtglm-service-sdk/build/constants/mutable_properties";

const { MATCH_TABLE_NAME, SEASON_METADATA_TABLE_NAME } = process.env;

const matchClient = new MTGLMDynamoClient(MATCH_TABLE_NAME, PROPERTIES_MATCH);
const seasonMetadataClient = new MTGLMDynamoClient(
  SEASON_METADATA_TABLE_NAME,
  PROPERTIES_SEASON_METADATA
);

const buildResponse = (matchResult: AttributeMap): MatchResponse => {
  const matchNode = matchMapper.toNode(matchResult);
  const matchView = matchMapper.toView(matchNode);

  return {
    ...matchView,
    season: matchNode.seasonId,
    losers: matchNode.loserIds,
    winner: matchNode.winnerId
  };
};

const updateSeasonMetadata = async (
  seasonId: string,
  matchResult: AttributeMap
): Promise<AttributeMap[]> => {
  const matchNode = matchMapper.toNode(matchResult);
  
  const loserMetadataKeys = matchNode.loserIds.map((loserId) => ({ seasonId, playerId: loserId }));
  const loserMetadataResults = await seasonMetadataClient.fetchByKeys(loserMetadataKeys);

  const winnerMetadataResults = await seasonMetadataClient.fetchByKey({
    seasonId,
    playerId: matchNode.winnerId
  });

  if (!winnerMetadataResults || !loserMetadataResults.length) {
    throw new Error("Error getting metadata. Season id or player id(s) are invalid.");
  }

  const loserMetadataNodes = loserMetadataResults.map(seasonMapper.toMetadataNode);
  const allPlayers = [...matchNode.loserIds, matchNode.winnerId];

  return await Promise.all(
    loserMetadataNodes.map((loserNode) => {
      const { playerId, playedOpponentIds, seasonWins, seasonLosses, totalLosses } = loserNode;

      const isSeasonMatch = matchNode.isSeasonPoint;

      const totalSeasonWins = isSeasonMatch ? seasonWins + 1 : seasonWins;
      const totalSeasonLosses = isSeasonMatch ? totalLosses + 1 : seasonLosses;
      const totalMatchLosses = totalLosses + 1;

      const newPlayedOpponents = playedOpponentIds.filter(
        (playedOpponentId) => !allPlayers.includes(playedOpponentId)
      );

      return seasonMetadataClient.update(
        { seasonId, playerId },
        {
          seasonWins: totalSeasonWins,
          seasonLosses: totalSeasonLosses,
          totalLosses: totalMatchLosses,
          playedOpponentIds: newPlayedOpponents
        }
      );
    })
  );
};

export const create = async (data: MatchCreateRequest): Promise<MatchResponse> => {
  const matchItem = matchMapper.toCreateItem(data);

  const matchResult = await matchClient.create({ matchId: matchItem.matchId }, matchItem);

  await updateSeasonMetadata(matchItem.seasonId, matchResult);

  return buildResponse(matchResult);
};

export const get = async (matchId: string): Promise<MatchResponse> => {
  const matchResult = await matchClient.fetchByKey({ matchId });

  return buildResponse(matchResult);
};

export const remove = async (matchId: string): Promise<SuccessResponse> => {
  await matchClient.remove({ matchId });

  return { message: "Successfully deleted match." };
};
