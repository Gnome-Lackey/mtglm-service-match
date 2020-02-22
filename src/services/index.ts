import { AttributeMap } from "aws-sdk/clients/dynamodb";

import { MTGLMDynamoClient } from "mtglm-service-sdk/build/clients/dynamo";

import * as matchMapper from "mtglm-service-sdk/build/mappers/match";
import * as queryMapper from "mtglm-service-sdk/build/mappers/query";

import { SuccessResponse, MatchResponse } from "mtglm-service-sdk/build/models/Responses";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";

import { PROPERTIES_MATCH } from "mtglm-service-sdk/build/constants/mutable_properties";
import { MatchQueryParameters } from "mtglm-service-sdk/build/models/QueryParameters";

const { MATCH_TABLE_NAME } = process.env;

const matchClient = new MTGLMDynamoClient(MATCH_TABLE_NAME, PROPERTIES_MATCH);

const buildResponse = (matchResult: AttributeMap): MatchResponse => {
  const matchNode = matchMapper.toNode(matchResult);
  const matchView = matchMapper.toView(matchNode);

  return {
    ...matchView,
    season: matchNode.seasonId,
    losers: matchNode.loserIds,
    winners: matchNode.winnerIds
  };
};

export const create = async (data: MatchCreateRequest): Promise<MatchResponse> => {
  const existingSeasonMatch = await matchClient.query({
    winnerIds: data.winners,
    loserIds: data.losers
  });

  const matchItem = matchMapper.toCreateItem({ ...data, isSeasonPoint: !existingSeasonMatch });

  const matchResult = await matchClient.create({ matchId: matchItem.matchId }, matchItem);

  return buildResponse(matchResult);
};

export const query = async (queryParameters: MatchQueryParameters): Promise<MatchResponse[]> => {
  const filters = queryMapper.toMatchFilters(queryParameters);

  const matchResults = await matchClient.query(filters);

  if (!matchResults.length) {
    return [];
  }

  return matchResults.map(buildResponse);
};

export const get = async (matchId: string): Promise<MatchResponse> => {
  const matchResult = await matchClient.fetchByKey({ matchId });

  return buildResponse(matchResult);
};

export const remove = async (matchId: string): Promise<SuccessResponse> => {
  await matchClient.remove({ matchId });

  return { message: "Successfully deleted match." };
};
