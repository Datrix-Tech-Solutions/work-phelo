import 'package:flutter/material.dart';
import 'package:hr_phelo/Components/app_theme/padding.dart';

class DisplayCard extends StatefulWidget {
  final Widget child;
  const DisplayCard({super.key, required this.child});

  @override
  State<DisplayCard> createState() => _DisplayCardState();
}

class _DisplayCardState extends State<DisplayCard>
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
    final colorScheme = ColorScheme.of(context);
    final effectiveBorderColor = colorScheme.outline;

    final cardContent = Card(
      elevation: 0,
      color: colorScheme.surfaceContainer,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: effectiveBorderColor, width: 1.0),
      ),
      margin: EdgeInsets.zero,
      child: Padding(padding: menuItemPadding, child: widget.child),
    );

    return Padding(
      padding: myContentPadding,
      child: FadeTransition(
        opacity: _fadeAnimation,
        child: SlideTransition(position: _slide, child: cardContent),
      ),
    );
  }
}
