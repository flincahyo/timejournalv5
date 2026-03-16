"use client";

import { usePathname, useRouter } from "next/navigation";
import { 
  BarChart2, 
  Calendar, 
  Settings, 
  Layout, 
  Home, 
  BookOpen, 
  PieChart, 
  Activity, 
  Terminal, 
  Bell,
  LogOut,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useTerminalStore, useThemeStore, useNewsStore, useMT5Store, useUIStore } from "@/store";
import { useEffect, useState } from "react";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isEditMode, toggleEditMode, resetLayout, clearLayout } = useTerminalStore();
  const { clear: clearTheme } = useThemeStore();
  const { clear: clearNews } = useNewsStore();
  const { disconnectMT5 } = useMT5Store();
  const { openDrawer } = useUIStore();

  const isTerminal = pathname === "/dashboard/terminal";

  return (
    <Sidebar collapsible="icon" className="border-none bg-bg/40 backdrop-blur-2xl">
      <SidebarContent className="px-2 py-2 gap-0">
        {isTerminal ? (
          <SidebarGroup className="p-0">
            <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-widest text-text3/60 mb-0.5 mt-2">
              Terminal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    isActive={pathname === "/dashboard/terminal" && !isEditMode}
                    onClick={() => router.push("/dashboard/terminal")}
                    tooltip="Open Terminal"
                    className="h-9"
                  >
                    <Terminal size={18} />
                    <span className="font-medium text-[13px]">Open Terminal</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    isActive={isEditMode}
                    onClick={() => toggleEditMode()}
                    tooltip={isEditMode ? "Save Layout" : "Edit Layout"}
                    className={`h-9 ${isEditMode ? "text-accent bg-accent/5" : ""}`}
                  >
                    <Layout size={18} />
                    <span className="font-medium text-[13px]">{isEditMode ? "Save Layout" : "Edit Layout"}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={resetLayout}
                    tooltip="Reset Layout"
                    className="h-9"
                  >
                    <Activity size={18} />
                    <span className="font-medium text-[13px]">Reset Layout</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => openDrawer('recap_settings')}
                    tooltip="Recap Settings"
                    className="h-9"
                  >
                    <Settings size={18} />
                    <span className="font-medium text-[13px]">Recap Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-widest text-text3/60 mb-0.5 mt-2">
                Main
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname === "/dashboard"}
                      onClick={() => router.push("/dashboard")}
                      tooltip="Dashboard"
                      className="h-9"
                    >
                      <Home size={18} />
                      <span className="font-medium text-[13px]">Dashboard</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname === "/dashboard/analytics"}
                      onClick={() => router.push("/dashboard/analytics")}
                      tooltip="Analytics"
                      className="h-9"
                    >
                      <PieChart size={18} />
                      <span className="font-medium text-[13px]">Analytics</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-widest text-text3/60 mb-0.5 mt-2">
                Activity
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname === "/dashboard/journal"}
                      onClick={() => router.push("/dashboard/journal")}
                      tooltip="Journaling"
                      className="h-9"
                    >
                      <BookOpen size={18} />
                      <span className="font-medium text-[13px]">Journaling</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname === "/dashboard/calendar"}
                      onClick={() => router.push("/dashboard/calendar")}
                      tooltip="Trading Calendar"
                      className="h-9"
                    >
                      <Calendar size={18} />
                      <span className="font-medium text-[13px]">Trading Calendar</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="px-2 text-[10px] font-medium uppercase tracking-widest text-text3/60 mb-0.5 mt-2">
                Tools
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname === "/dashboard/alerts"}
                      onClick={() => router.push("/dashboard/alerts")}
                      tooltip="Price Alerts"
                      className="h-9"
                    >
                      <Bell size={18} />
                      <span className="font-medium text-[13px]">Price Alerts</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      isActive={pathname === "/dashboard/terminal"}
                      onClick={() => router.push("/dashboard/terminal")}
                      tooltip="Trade Terminal"
                      className="h-9"
                    >
                      <Activity size={18} />
                      <span className="font-medium text-[13px]">Trade Terminal</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-border/50">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton 
              isActive={pathname === "/dashboard/settings"}
              onClick={() => router.push("/dashboard/settings")}
              tooltip="Settings"
              className="h-9"
            >
              <Settings size={18} />
              <span className="font-medium text-[13px]">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
              tooltip="Logout"
              onClick={async () => {
                try {
                  await Promise.allSettled([
                    disconnectMT5(),
                    Promise.resolve(clearLayout()),
                    Promise.resolve(clearTheme()),
                    Promise.resolve(clearNews())
                  ]);
                } catch (err) {
                  console.error("Logout cleanup error:", err);
                } finally {
                  localStorage.removeItem('uj_token');
                  localStorage.removeItem('token');
                  window.location.href = '/login';
                }
              }}
            >
              <LogOut size={16} />
              <span className="font-medium text-[13px]">Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
