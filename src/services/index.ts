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
  const winnerMetadataResult = await seasonMetadataClient.fetchByKey({
    seasonId,
    playerId: matchNode.winnerId
  });

  if (!winnerMetadataResult || !loserMetadataResults.length) {
    throw new Error("Error getting metadata. Season id or player id(s) are invalid.");
  }

  const {
    playerId: winnerId,
    seasonWins: winnerSeasonWins,
    playedOpponentIds: winnerOpponentIds,
    totalWins: winnerTotalWins
  } = seasonMapper.toMetadataNode(winnerMetadataResult);

  const loserMetadataNodes = loserMetadataResults.map(seasonMapper.toMetadataNode);
  const allPlayersInMatch = [...matchNode.loserIds, matchNode.winnerId];
  const isSeasonMatch = matchNode.isSeasonPoint;

  const shouldFilterOpponent = (id: string, players: string[]): boolean => !players.includes(id);

  await Promise.all([
    seasonMetadataClient.update(
      { seasonId, playerId: winnerId },
      {
        seasonWins: isSeasonMatch ? winnerSeasonWins + 1 : winnerSeasonWins,
        totalWins: winnerTotalWins + 1,
        playedOpponentIds: [
          ...winnerOpponentIds,
          ...matchNode.loserIds.filter((id) => shouldFilterOpponent(id, winnerOpponentIds))
        ]
      }
    ),
    ...loserMetadataNodes.map((loserNode) => {
      const {
        playerId: loserId,
        playedOpponentIds: loserOpponentIds,
        seasonLosses: listerSeasonLosses,
        totalLosses: loserTotalLosses
      } = loserNode;

      const totalSeasonLosses = isSeasonMatch ? loserTotalLosses + 1 : listerSeasonLosses;
      const totalMatchLosses = loserTotalLosses + 1;

      const newOpponents = allPlayersInMatch.filter((id) => id !== loserId);

      const newPlayedOpponents = [
        ...loserOpponentIds,
        ...newOpponents.filter((id) => shouldFilterOpponent(id, loserOpponentIds))
      ];

      return seasonMetadataClient.update(
        { seasonId, playerId: loserId },
        {
          seasonLosses: totalSeasonLosses,
          totalLosses: totalMatchLosses,
          playedOpponentIds: newPlayedOpponents
        }
      );
    })
  ]);

  return;
};

export const create = async (data: MatchCreateRequest): Promise<MatchResponse> => {
  const existingSeasonMatch = await matchClient.query({
    winnerId: data.winner,
    loserIds: data.losers
  });

  const matchItem = matchMapper.toCreateItem({ ...data, isSeasonPoint: !existingSeasonMatch });

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
