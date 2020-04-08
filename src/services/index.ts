import { AttributeMap } from "aws-sdk/clients/dynamodb";

import MTGLMDynamoClient from "mtglm-service-sdk/build/clients/dynamo";

import MatchMapper from "mtglm-service-sdk/build/mappers/match";

import { SuccessResponse, MatchResponse } from "mtglm-service-sdk/build/models/Responses";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";
import { MatchQueryParameters } from "mtglm-service-sdk/build/models/QueryParameters";

import { PROPERTIES_MATCH } from "mtglm-service-sdk/build/constants/mutable_properties";

export default class MatchService {
  private tableName = process.env.MATCH_TABLE_NAME;

  private client = new MTGLMDynamoClient(this.tableName, PROPERTIES_MATCH);
  private mapper = new MatchMapper();

  private buildResponse = (matchResult: AttributeMap): MatchResponse => {
    const matchNode = this.mapper.toNode(matchResult);
    const matchView = this.mapper.toView(matchNode);

    return {
      ...matchView,
      season: matchNode.seasonId,
      losers: matchNode.loserIds,
      winners: matchNode.winnerIds
    };
  };

  create = async (data: MatchCreateRequest): Promise<MatchResponse> => {
    const idQuery = `[]${data.winners.join(",")},${data.losers.join(",")}`;

    const filters = this.mapper.toFilters({
      season: data.season,
      winners: idQuery,
      losers: idQuery,
      seasonPoint: "true"
    });

    const searchBySameResults = await this.client.query(filters);

    const isSeasonPoint = !searchBySameResults || !searchBySameResults.length;

    const matchItem = this.mapper.toCreateItem({ ...data, isSeasonPoint });

    const matchResult = await this.client.create({ matchId: matchItem.matchId }, matchItem);

    return this.buildResponse(matchResult);
  };

  query = async (queryParameters: MatchQueryParameters): Promise<MatchResponse[]> => {
    const filters = this.mapper.toFilters(queryParameters);

    const matchResults = await this.client.query(filters);

    if (!matchResults.length) {
      return [];
    }

    return matchResults.map(this.buildResponse);
  };

  get = async (matchId: string): Promise<MatchResponse> => {
    const matchResult = await this.client.fetchByKey({ matchId });

    return this.buildResponse(matchResult);
  };

  remove = async (matchId: string): Promise<SuccessResponse> => {
    await this.client.remove({ matchId });

    return { message: "Successfully deleted match." };
  };
}
