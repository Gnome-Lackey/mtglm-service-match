import requestMiddleware from "mtglm-service-sdk/build/middleware/requestResource";

import { LambdaResponse } from "mtglm-service-sdk/build/models/Lambda";
import { MatchPathParameters } from "mtglm-service-sdk/build/models/PathParameters";
import { MatchQueryParameters } from "mtglm-service-sdk/build/models/QueryParameters";

import MatchController from "../controllers";

const controller = new MatchController();

module.exports.handler = requestMiddleware(
  async (
    path: MatchPathParameters,
    data: object,
    queryParameters: MatchQueryParameters
  ): Promise<LambdaResponse> => {
    const response = await controller.query(queryParameters);

    return response;
  }
);
