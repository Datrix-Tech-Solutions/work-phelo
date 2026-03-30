import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unicons/unicons.dart';
import 'package:work_phelo/work_phelo_funtions/work_phelo_users/user_model.dart';
import 'logout_confirmation_popup.dart';

class UserDetailsPopup {
  static OverlayEntry? _entry;

  static void show(BuildContext context, Offset offset, AppUserModel currentUser,WidgetRef ref) {
    _dismiss();

    final initials = currentUser.fullName
        .trim()
        .split(' ')
        .map((e) => e.isNotEmpty ? e[0] : '')
        .take(2)
        .join()
        .toUpperCase();

    _entry = OverlayEntry(
      builder: (ctx) {
        final cs = ColorScheme.of(context);
        return Stack(
          children: [
            // Tap outside to dismiss
            Positioned.fill(
              child: GestureDetector(
                onTap: _dismiss,
                behavior: HitTestBehavior.translucent,
              ),
            ),
            Positioned(
              top: offset.dy + 8,
              right: 16,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  width: 220,
                  decoration: BoxDecoration(
                    color: cs.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: cs.outlineVariant.withAlpha(40),
                      width: 0.5,
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── Header ──────────────────────────────
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                        child: Row(
                          children: [
                            CircleAvatar(
                              radius: 18,
                              backgroundColor: cs.primaryContainer,
                              child: Text(
                                initials,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: cs.onPrimaryContainer,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    currentUser.fullName,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  Text(
                                    currentUser.email,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: cs.onSurfaceVariant,
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),

                      Divider(
                        height: 1,
                        color: cs.outlineVariant.withAlpha(40),
                      ),

                      // ── Menu items ───────────────────────────
                      Padding(
                        padding: const EdgeInsets.all(6),
                        child: Column(
                          children: [
                            _menuItem(
                              context: context,
                              icon: UniconsLine.user_circle,
                              label: 'Profile',
                              onTap: () {
                                _dismiss();
                                // navigate to profile
                              },
                            ),
                            _menuItem(
                              context: context,
                              icon: UniconsLine.setting,
                              label: 'Settings',
                              onTap: () {
                                _dismiss();
                                // navigate to settings
                              },
                            ),
                          ],
                        ),
                      ),

                      Divider(
                        height: 1,
                        color: cs.outlineVariant.withAlpha(40),
                      ),

                      // ── Sign out ─────────────────────────────
                      Padding(
                        padding: const EdgeInsets.all(6),
                        child: _menuItem(
                          context: context,
                          icon: UniconsLine.signout,
                          label: 'Sign out',
                          isDestructive: true,
                          onTap: () {
                            _dismiss();
                            logoutConfirmationPopup(context,ref);
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );

    Overlay.of(context).insert(_entry!);
  }

  static void _dismiss() {
    _entry?.remove();
    _entry = null;
  }

  static Widget _menuItem({
    required BuildContext context,
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    final cs = ColorScheme.of(context);
    final color = isDestructive ? cs.error : cs.onSurfaceVariant;
    final hoverColor = isDestructive
        ? cs.errorContainer.withAlpha(20)
        : cs.surfaceContainerHighest;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        hoverColor: hoverColor,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          child: Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  color: isDestructive ? cs.error : cs.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
