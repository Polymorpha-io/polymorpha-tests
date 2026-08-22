import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
} from "@/components/shadcn/avatar";
import {
  Camera,
  CheckCircle2,
  Loader2,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { useProfileCard } from "@/pages/profile-v2/hooks/useProfileCard";

export function ProfileCard() {
  const {
    user,
    loading,
    error,
    resetError,
    setAvatarFile,
    uploadingAvatar,
    avatarInputRef,
    avatarPreviewUrl,
    isEditingProfile,
    setIsEditingProfile,
    newDisplayName,
    setNewDisplayName,
    emailMessage,
    emailVerified,
    displayNameText,
    avatarAlt,
    isCustomAvatar,
    handleAvatarChange,
    handleUpdateProfile,
    handleVerifyEmail,
    handleSignOut,
  } = useProfileCard();

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm flex max-md:flex-col overflow-hidden mb-6 shrink md:w-fit">
      <div className="bg-muted border-r border-border p-6 px-5 flex flex-col items-center gap-1 shrink-0 max-md:border-r-0 max-md:border-b md:max-w-[240px] max-md:w-full max-md:p-4 max-md:gap-1">
        <div className="relative">
          <Avatar className="size-20 border-2 border-border">
            <AvatarImage
              src={
                avatarPreviewUrl ??
                (isCustomAvatar(user?.photoURL)
                  ? (user?.photoURL ?? undefined)
                  : undefined)
              }
              alt={avatarAlt}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            <AvatarFallback className="text-2xl font-extrabold bg-muted text-muted-foreground">
              {(user?.displayName ?? user?.email ?? "?")[0].toUpperCase()}
            </AvatarFallback>
            <label
              className="cursor-pointer"
              aria-label="Change profile picture"
            >
              <AvatarBadge className="size-6! [&>svg]:size-3! bg-background! text-muted-foreground! border border-border! dark:bg-primary! dark:text-primary-foreground! dark:border-primary!">
                {uploadingAvatar ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Camera className="size-3" />
                )}
              </AvatarBadge>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleAvatarChange}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </Avatar>
        </div>
        <div className="flex items-center min-w-0 w-full justify-center">
          <div
            className="text-lg font-semibold text-card-foreground text-center tracking-wide line-clamp-3 min-w-0"
            title={displayNameText}
          >
            {displayNameText}
          </div>
          {!isEditingProfile && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-50 hover:opacity-100 transition-opacity shrink-0"
              onClick={() => {
                setIsEditingProfile(true);
                setNewDisplayName(user?.displayName || "");
                resetError();
              }}
              aria-label="Edit display name"
            >
              <Pencil className="size-3" />
            </Button>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground opacity-60 text-center tracking-wide">
          Member since {user?.createdAt.toLocaleDateString()}
        </div>
      </div>
      <div className="flex-1 p-6 flex flex-col justify-center gap-4 max-md:p-5 min-w-0">
        {isEditingProfile && (
          <form
            onSubmit={handleUpdateProfile}
            className="flex flex-col gap-2 max-w-72"
          >
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Display Name"
              required
              className="px-2 py-1 border border-border rounded-sm bg-muted text-card-foreground"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || uploadingAvatar}>
                {uploadingAvatar ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsEditingProfile(false);
                  setAvatarFile(null);
                }}
                disabled={loading || uploadingAvatar}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
        <div className="flex items-center gap-2.5 flex-wrap max-md:flex-col max-md:items-start max-md:gap-2">
          <span className="text-[11px] font-medium text-muted-foreground opacity-50 uppercase tracking-wider min-w-12">
            Email
          </span>
          <span className="text-sm text-muted-foreground min-w-0 truncate">
            {user?.email}
          </span>
          {emailVerified ? (
            <Badge
              variant="outline"
              className="text-success border-success/30 bg-success/10"
            >
              <CheckCircle2 className="size-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="destructive">
              <TriangleAlert className="size-3" />
              Unverified
            </Badge>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {emailMessage && (
          <p className="text-xs text-blue-400">{emailMessage}</p>
        )}
        <div className="flex gap-2 mt-2 pt-4 border-t border-border max-md:flex-col max-md:gap-2 flex-wrap">
          {!emailVerified && user?.email && (
            <Button
              onClick={handleVerifyEmail}
              disabled={loading}
              className="max-md:w-full max-md:min-h-11"
            >
              {loading ? "..." : "Send verification"}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="max-md:w-full max-md:min-h-11"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
