import requestMiddleware from "mtglm-service-sdk/build/middleware/requestResource";

import { LambdaResponse } from "mtglm-service-sdk/build/models/Lambda";
import { MatchPathParameters } from "mtglm-service-sdk/build/models/PathParameters";

import MatchController from "../controllers";

const controller = new MatchController();

module.exports.handler = requestMiddleware(
  async (path: MatchPathParameters): Promise<LambdaResponse> => {
    const { matchId } = path;

    const response = await controller.remove(matchId);

    return response;
  }
);
