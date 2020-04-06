import { logFailure, logSuccess } from "mtglm-service-sdk/build/utils/logger";
import { handleError, handleSuccess } from "mtglm-service-sdk/build/utils/response";

import { LambdaResponse } from "mtglm-service-sdk/build/models/Lambda";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";
import { MatchQueryParameters } from "mtglm-service-sdk/build/models/QueryParameters";

import MatchService from "../services";

export default class MatchController {
  private service = new MatchService();

  async create(data: MatchCreateRequest): Promise<LambdaResponse> {
    try {
      const result = await this.service.create(data);

      logSuccess("DYNAMO", "POST match", result);

      return handleSuccess(result);
    } catch (error) {
      logFailure("DYNAMO", "POST match", error);

      return handleError(error);
    }
  }

  async get(matchId: string): Promise<LambdaResponse> {
    try {
      const result = await this.service.get(matchId);

      logSuccess("DYNAMO", "GET match", result);

      return handleSuccess(result);
    } catch (error) {
      logFailure("DYNAMO", "GET match", error);

      return handleError(error);
    }
  }

  async query(queryParameters: MatchQueryParameters): Promise<LambdaResponse> {
    try {
      const result = await this.service.query(queryParameters);

      logSuccess("DYNAMO", "Query matches", result);

      return handleSuccess(result);
    } catch (error) {
      logFailure("DYNAMO", "Query matches", error);

      return handleError(error);
    }
  }

  async remove(matchId: string): Promise<LambdaResponse> {
    try {
      const result = await this.service.remove(matchId);

      logSuccess("DYNAMO", "DELETE match", result);

      return handleSuccess(result);
    } catch (error) {
      logFailure("DYNAMO", "DELETE match", error);

      return handleError(error);
    }
  }
}
