import { logFailure, logSuccess } from "mtglm-service-sdk/build/utils/logger";
import { handleError, handleSuccess } from "mtglm-service-sdk/build/utils/response";

import { LambdaResponse } from "mtglm-service-sdk/build/models/Lambda";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";

import * as service from "../services";

export const create = async (data: MatchCreateRequest): Promise<LambdaResponse> => {
  try {
    const result = await service.create(data);

    logSuccess("DYNAMO", "POST mach", result);

    return handleSuccess(result);
  } catch (error) {
    logFailure("DYNAMO", "POST mach", error);

    return handleError(error);
  }
};

export const get = async (machId: string): Promise<LambdaResponse> => {
  try {
    const result = await service.get(machId);

    logSuccess("DYNAMO", "GET mach", result);

    return handleSuccess(result);
  } catch (error) {
    logFailure("DYNAMO", "GET mach", error);

    return handleError(error);
  }
};

export const remove = async (machId: string): Promise<LambdaResponse> => {
  try {
    const result = await service.remove(machId);

    logSuccess("DYNAMO", "DELETE mach", result);

    return handleSuccess(result);
  } catch (error) {
    logFailure("DYNAMO", "DELETE mach", error);

    return handleError(error);
  }
};
