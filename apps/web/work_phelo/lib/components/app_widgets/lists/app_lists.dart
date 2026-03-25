import 'package:flutter/material.dart';
import 'package:unicons/unicons.dart';

import '../../app_theme/misc.dart';
import '../../app_theme/padding.dart';
import '../../app_theme/text_styles.dart';
import '../cards/display_card.dart';

class AppListWidget extends StatefulWidget {
  final String headerTitle;
  final String? headerTrailingText;
  final int itemCount;
  final Widget Function(BuildContext, int) itemBuilder;
  final Widget? search;

  const AppListWidget({
    super.key,
    required this.headerTitle,
    this.headerTrailingText,
    required this.itemCount,
    required this.itemBuilder,
    this.search,
  });

  @override
  State<AppListWidget> createState() => _AppListWidgetState();
}

class _AppListWidgetState extends State<AppListWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );

    _slide = Tween<Offset>(begin: const Offset(0, 0.08), end: Offset.zero)
        .animate(
          CurvedAnimation(
            parent: _controller,
            curve: const Interval(0.0, 1, curve: Curves.easeOut),
          ),
        );

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fadeAnimation,
      child: Column(
        children: [
          if (widget.search != null) widget.search!,
          ListTile(
            title: Text(widget.headerTitle, style: myTitleTextStyle(context)),
            trailing: widget.headerTrailingText != null
                ? Text(widget.headerTrailingText!)
                : null,
          ),
          myDivider(context),
          Expanded(
            child: SlideTransition(
              position: _slide,
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                itemCount: widget.itemCount,
                itemBuilder: widget.itemBuilder,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class TableColumn {
  final String header;
  final TableColumnWidth width;

  const TableColumn({
    required this.header,
    this.width = const FlexColumnWidth(1),
  });
}

enum TableDisplayMode { table, grid }

typedef TableRowBuilder =
    List<Widget> Function(BuildContext context, int index);

class AppTableWidget extends StatefulWidget {
  final String headerTitle;
  final String? details;
  final Widget? headerTrailing;
  final Widget? search;
  final List<TableColumn> columns;
  final int itemCount;
  final TableRowBuilder rowBuilder;
  final TableDisplayMode displayMode;
  final double gridChildAspectRatio;
  final int gridCrossAxisCount;
  final Widget Function(BuildContext, int)? gridItemBuilder;

  const AppTableWidget({
    super.key,
    required this.headerTitle,
    this.details,
    this.headerTrailing,
    this.search,
    required this.columns,
    required this.itemCount,
    required this.rowBuilder,
    this.displayMode = TableDisplayMode.table,
    this.gridChildAspectRatio = 1.2,
    this.gridCrossAxisCount = 3,
    this.gridItemBuilder,
  });

  @override
  State<AppTableWidget> createState() => _AppTableWidgetState();
}

class _AppTableWidgetState extends State<AppTableWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _fade = CurvedAnimation(parent: _controller, curve: Curves.easeOut);
    _slide = Tween<Offset>(
      begin: const Offset(0, 0.04),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Map<int, TableColumnWidth> get _columnWidths {
    return {
      for (int i = 0; i < widget.columns.length; i++)
        i: widget.columns[i].width,
    };
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [Expanded(child: _buildTable(context, cs))],
        ),
      ),
    );
  }

  Widget _buildTable(BuildContext context, ColorScheme cs) {
    return DisplayCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header ──────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.headerTitle,
                      style: myMainTextStyle(
                        context,
                      ).copyWith(fontWeight: FontWeight.w600, fontSize: 15),
                    ),
                    if (widget.details != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        widget.details!,
                        style: myMainTextStyle(
                          context,
                        ).copyWith(fontSize: 12, color: cs.onSurfaceVariant),
                      ),
                    ],
                  ],
                ),
              ),
              if (widget.search != null) ...[
                widget.search!,
                const SizedBox(width: 8),
              ],
              if (widget.headerTrailing != null) widget.headerTrailing!,
            ],
          ),

          // ── Column headers ───────────────────────────────
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(appRadius/2),
            ),
            elevation: 0,
            color: ColorScheme.of(context).outline.withAlpha(70),
            child: Table(
              columnWidths: _columnWidths,
              defaultVerticalAlignment: TableCellVerticalAlignment.middle,
              children: [
                TableRow(
                  children: widget.columns.map((col) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      child: Text(
                        col.header,
                        style: myMainTextStyle(context).copyWith(
                          fontWeight: FontWeight.w500,
                          color: cs.onSurfaceVariant,
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
          myDivider(context),
          Padding(padding: myContentPadding),

          // ── Rows / Empty state ───────────────────────────
          if (widget.itemCount == 0)
            Expanded(child: _buildEmptyState(context, cs))
          else
            Expanded(
              child: SingleChildScrollView(
                child: Table(
                  columnWidths: _columnWidths,
                  defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                  children: List.generate(widget.itemCount, (i) {
                    final cells = widget.rowBuilder(context, i);
                    return TableRow(
                      children: cells
                          .map(
                            (cell) =>
                                Padding(padding: myContentPadding, child: cell),
                          )
                          .toList(),
                    );
                  }),
                ),
              ),
            ),

          // ── Footer ──────────────────────────────────────
          if (widget.itemCount > 0) ...[
            myDivider(context),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              child: Text(
                '${widget.itemCount} ${widget.itemCount == 1 ? 'record' : 'records'}',
                style: myMainTextStyle(
                  context,
                ).copyWith(fontSize: 12, color: cs.onSurfaceVariant),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context, ColorScheme cs) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(UniconsLine.inbox, size: 100, color: cs.outline),
          const SizedBox(height: 12),
          Text(
            'No data yet',
            style: myMainTextStyle(
              context,
            ).copyWith(fontWeight: FontWeight.w500, color: cs.onSurfaceVariant),
          ),
          const SizedBox(height: 4),
          Text(
            'Records will appear here once added',
            style: myMainTextStyle(
              context,
            ).copyWith(fontSize: 12, color: cs.outlineVariant),
          ),
        ],
      ),
    );
  }
}
