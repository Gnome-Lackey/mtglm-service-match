import { logFailure, logSuccess } from "mtglm-service-sdk/build/utils/logger";
import { handleError, handleSuccess } from "mtglm-service-sdk/build/utils/response";

import { LambdaResponse } from "mtglm-service-sdk/build/models/Lambda";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";
import { MatchQueryParameters } from "mtglm-service-sdk/build/models/QueryParameters";

import * as service from "../services";

export const create = async (data: MatchCreateRequest): Promise<LambdaResponse> => {
  try {
    const result = await service.create(data);

    logSuccess("DYNAMO", "POST match", result);

    return handleSuccess(result);
  } catch (error) {
    logFailure("DYNAMO", "POST match", error);

    return handleError(error);
  }
};

export const get = async (matchId: string): Promise<LambdaResponse> => {
  try {
    const result = await service.get(matchId);

    logSuccess("DYNAMO", "GET match", result);

    return handleSuccess(result);
  } catch (error) {
    logFailure("DYNAMO", "GET match", error);

    return handleError(error);
  }
};

export const query = async (queryParameters: MatchQueryParameters): Promise<LambdaResponse> => {
  try {
    const result = await service.query(queryParameters);

    logSuccess("DYNAMO", "Query matches", result);

    return handleSuccess(result);
  } catch (error) {
    logFailure("DYNAMO", "Query matches", error);

    return handleError(error);
  }
};

export const remove = async (matchId: string): Promise<LambdaResponse> => {
  try {
    const result = await service.remove(matchId);

    logSuccess("DYNAMO", "DELETE match", result);

    return handleSuccess(result);
  } catch (error) {
    logFailure("DYNAMO", "DELETE match", error);

    return handleError(error);
  }
};
