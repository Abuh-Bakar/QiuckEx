import { SetMetadata } from "@nestjs/common";
import type { RateLimitGroup, RateLimitTier } from "../../config/rate-limit.config";
import {
  RATE_LIMIT_GROUP_METADATA_KEY,
  RATE_LIMIT_TIER_METADATA_KEY,
} from "../../config/rate-limit.config";

export const RateLimitGroupTag = (group: RateLimitGroup) =>
  SetMetadata(RATE_LIMIT_GROUP_METADATA_KEY, group);

export const RateLimitTier = (tier: RateLimitTier) =>
  SetMetadata(RATE_LIMIT_TIER_METADATA_KEY, tier);
