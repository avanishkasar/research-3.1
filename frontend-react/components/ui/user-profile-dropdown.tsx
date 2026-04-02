"use client";

import * as React from "react";
import { ChevronRight, MessageSquare, Phone, ExternalLink, Edit, Share2, Trash2, Move, CheckSquare, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserProfile {
  name: string;
  handle: string;
  avatarUrl: string;
}

interface ActionItem {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  isDestructive?: boolean;
  hasArrow?: boolean;
}

interface UserProfileDropdownProps {
  user: UserProfile;
  actions: ActionItem[];
  menuItems: MenuItem[];
}

export function UserProfileDropdown({ user, actions, menuItems }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg border bg-card p-2 text-left hover:bg-muted/50">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.handle}</p>
          </div>
        </button>
      </DropdownMenuTrigger>

      <AnimatePresence>
        {isOpen && (
          <DropdownMenuContent asChild forceMount align="start" className="w-64 p-2">
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
            >
              <DropdownMenuLabel className="flex items-center gap-2 p-2">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.handle}</p>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="mx-2" />
              <DropdownMenuGroup>
                <div className="grid grid-cols-3 gap-1 p-1">
                  {actions.map((action) => (
                    <Button key={action.label} variant="ghost" className="h-16 flex-col gap-1" onClick={action.onClick}>
                      <action.icon className="h-4 w-4" />
                      <span className="text-[11px]">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="mx-2 mb-1" />
              <DropdownMenuGroup>
                {menuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    className={cn(item.isDestructive && "text-destructive focus:bg-destructive focus:text-destructive-foreground")}
                    onClick={item.onClick}
                  >
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    {item.hasArrow && <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </motion.div>
          </DropdownMenuContent>
        )}
      </AnimatePresence>
    </DropdownMenu>
  );
}

export function UserProfileDropdownDemo() {
  const user = {
    name: "Avanish Kasar",
    handle: "@avanish",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
  };

  const actions = [
    { icon: MessageSquare, label: "Message" },
    { icon: Phone, label: "Call" },
    { icon: ExternalLink, label: "Open" },
  ];

  const menuItems = [
    { icon: CheckSquare, label: "Set status", hasArrow: true },
    { icon: Move, label: "Move" },
    { icon: Edit, label: "Edit" },
    { icon: Share2, label: "Share" },
    { icon: Trash2, label: "Delete", isDestructive: true },
  ];

  return <UserProfileDropdown user={user} actions={actions} menuItems={menuItems} />;
}
