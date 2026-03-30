import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../theme/app_text_theme.dart';
import '../../theme/miscellaneouse.dart';

void confirmationPopup(
  BuildContext context,
  String popUpText,
  String popUpTitle,
  VoidCallback onConfirm,
  String btnText,
) {
  showDialog(
    context: context,
    builder: (context) {
      final cs = ColorScheme.of(context);
      return Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(shape: BoxShape.circle),
                      child: Icon(
                        UniconsLine.sign_out_alt,
                        size: 16,
                        color: cs.primary,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            popUpTitle,
                            style: myNoInfoStyle(
                              context,
                            ).copyWith(color: cs.onSurface),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            popUpText,
                            style: myNoInfoStyle(context).copyWith(
                              fontSize: 13,
                              color: cs.onSurfaceVariant,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                myDivider(context),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: FilledButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(appRadius),
                        ),
                      ),
                      child: Text(
                        'Cancel',
                        style: myNoInfoStyle(
                          context,
                        ).copyWith(color: cs.onSurfaceVariant),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(appRadius),
                        ),
                        backgroundColor: cs.primary,
                        foregroundColor: cs.surface,
                      ),
                      onPressed: () {
                        onConfirm();
                      },
                      child: Text(btnText),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}
