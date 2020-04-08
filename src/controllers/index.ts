import MTGLMLogger from "mtglm-service-sdk/build/utils/logger";
import ResponseHandler from "mtglm-service-sdk/build/utils/response";

import { LambdaResponse } from "mtglm-service-sdk/build/models/Lambda";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";
import { MatchQueryParameters } from "mtglm-service-sdk/build/models/QueryParameters";

import MatchService from "../services";

export default class MatchController {
  private service = new MatchService();

  private logger = new MTGLMLogger();
  private responseHandler = new ResponseHandler();

  create = async (data: MatchCreateRequest): Promise<LambdaResponse> => {
    try {
      const result = await this.service.create(data);

      this.logger.success("DYNAMO", "POST match", result);

      return this.responseHandler.success(result);
    } catch (error) {
      this.logger.failure("DYNAMO", "POST match", error);

      return this.responseHandler.error(error);
    }
  };

  get = async (matchId: string): Promise<LambdaResponse> => {
    try {
      const result = await this.service.get(matchId);

      this.logger.success("DYNAMO", "GET match", result);

      return this.responseHandler.success(result);
    } catch (error) {
      this.logger.failure("DYNAMO", "GET match", error);

      return this.responseHandler.error(error);
    }
  };

  query = async (queryParameters: MatchQueryParameters): Promise<LambdaResponse> => {
    try {
      const result = await this.service.query(queryParameters);

      this.logger.success("DYNAMO", "Query matches", result);

      return this.responseHandler.success(result);
    } catch (error) {
      this.logger.failure("DYNAMO", "Query matches", error);

      return this.responseHandler.error(error);
    }
  };

  remove = async (matchId: string): Promise<LambdaResponse> => {
    try {
      const result = await this.service.remove(matchId);

      this.logger.success("DYNAMO", "DELETE match", result);

      return this.responseHandler.success(result);
    } catch (error) {
      this.logger.failure("DYNAMO", "DELETE match", error);

      return this.responseHandler.error(error);
    }
  };
}
