import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../../../../../components/form_components/my_buttons.dart';
import '../../../../../../components/form_components/text_fields.dart';

Widget buildSearchAndActionsBar(BuildContext context) {
  return Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
    child: Row(
      children: [
        Expanded(
          flex: 3,
          child: Row(
            children: [
              Flexible(
                flex: 3,
                child: CustomSearchField(
                  hinttext: 'Search by name, email, department...',
                  onChanged: (value) {
                    // filter logic
                  },
                ),
              ),
              // TODO: chnage to drop drop down
              Flexible(
                child: CustomSearchField(
                  hinttext: 'Search by name, email, department...',
                  onChanged: (value) {
                    // filter logic
                  },
                ),
              ),
            ],
          ),
        ),
        Spacer(),
        const SizedBox(width: 16),
        WidgetButton(
          btnText: 'export',
          btnPressed: () {},
          btnIcon: UniconsLine.export,
        ),
        const SizedBox(width: 12),
      ],
    ),
  );
}
