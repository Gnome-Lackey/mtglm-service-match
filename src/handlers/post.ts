import requestMiddleware from "mtglm-service-sdk/build/middleware/requestResource";

import { LambdaResponse } from "mtglm-service-sdk/build/models/Lambda";
import { MatchPathParameters } from "mtglm-service-sdk/build/models/PathParameters";
import { MatchCreateRequest } from "mtglm-service-sdk/build/models/Requests";

import MatchController from "../controllers";

const controller = new MatchController();

module.exports.handler = requestMiddleware(
  async (path: MatchPathParameters, data: MatchCreateRequest): Promise<LambdaResponse> => {
    const response = await controller.create(data);

    return response;
  }
);
