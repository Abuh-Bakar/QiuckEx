import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { InAppNotificationRepository } from "./in-app-notification.repository";
import { MarkManyReadDto } from "./dto/mark-many-read.dto";
import { RateLimitTier } from "../auth/decorators/rate-limit-group.decorator";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly inAppRepo: InAppNotificationRepository) {}

  @Get("in-app")
  @RateLimitTier("public-read")
  getInApp(@Req() req, @Query("page") page = 1, @Query("limit") limit = 20) {
    return this.inAppRepo.findByUser(req.user.publicKey, page, limit);
  }

  @Post("in-app/:id/read")
  @RateLimitTier("mutation")
  async markRead(@Req() req, @Param("id") id: string) {
    await this.inAppRepo.markAsRead(req.user.publicKey, id);

    const unreadCount = await this.inAppRepo.getUnreadCount(req.user.publicKey);

    return {
      success: true,
      unreadCount,
      syncedAt: new Date().toISOString(),
    };
  }

  @Post("in-app/read")
  @RateLimitTier("mutation")
  async markManyRead(@Req() req, @Body() body: MarkManyReadDto) {
    await this.inAppRepo.markManyAsRead(req.user.publicKey, body.ids);

    const unreadCount = await this.inAppRepo.getUnreadCount(req.user.publicKey);

    return {
      success: true,
      unreadCount,
      syncedAt: new Date().toISOString(),
    };
  }

  @Post("in-app/read-all")
  @RateLimitTier("mutation")
  async markAll(@Req() req) {
    await this.inAppRepo.markAllAsRead(req.user.publicKey);

    const unreadCount = await this.inAppRepo.getUnreadCount(req.user.publicKey);

    return {
      success: true,
      unreadCount,
      syncedAt: new Date().toISOString(),
    };
  }
}
