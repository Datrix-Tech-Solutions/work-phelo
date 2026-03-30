import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'company_asset_model.dart';

final assetsProvider = StateNotifierProvider<AssetsNotifier, List<AssetModel>>((
  ref,
) {
  return AssetsNotifier();
});

class AssetsNotifier extends StateNotifier<List<AssetModel>> {
  AssetsNotifier() : super([]);

  // Add a new asset
  void addAsset({
    required String tenantId,
    required String assetName,
    required String assetType,
    required String serialNumber,
    required DateTime purchaseDate,
    required String assetCondition,
    required String availability,
  }) {
    final existingCount = state.where((a) => a.assetType == assetType).length;
    final newAsset = AssetModel.create(
      tenantId: tenantId,
      assetName: assetName,
      assetType: assetType,
      serialNumber: serialNumber,
      purchaseDate: purchaseDate,
      assetCondition: assetCondition,
      availability: availability,
    );
    final correctedAsset = newAsset.copyWith(
      id: generateAssetId(assetType: assetType, count: existingCount),
    );

    state = [...state, correctedAsset];
  }

  // Update an existing asset
  void updateAsset(String assetId, AssetModel updatedAsset) {
    state = [
      for (final asset in state)
        if (asset.id == assetId) updatedAsset else asset,
    ];
  }

  // Delete an asset
  void deleteAsset(String assetId) {
    state = state.where((asset) => asset.id != assetId).toList();
  }

  // Get asset by ID
  AssetModel? getAssetById(String assetId) {
    try {
      return state.firstWhere((asset) => asset.id == assetId);
    } catch (e) {
      return null;
    }
  }

  // Clear all assets
  void clearAssets() {
    state = [];
  }
}

// Provider to get assets filtered by tenant
final tenantAssetsProvider = Provider<List<AssetModel>>((ref) {
  final assets = ref.watch(assetsProvider);
  return assets;
});

// Provider to filter assets by tenant ID
final tenantFilteredAssetsProvider = Provider.family<List<AssetModel>, String>((
  ref,
  tenantId,
) {
  final assets = ref.watch(assetsProvider);
  return assets.where((asset) => asset.tenantId == tenantId).toList();
});

// Provider to get assets by type
final assetsByTypeProvider = Provider.family<List<AssetModel>, String>((
  ref,
  assetType,
) {
  final assets = ref.watch(assetsProvider);
  return assets.where((asset) => asset.assetType == assetType).toList();
});

// Provider to get assets by availability
final assetsByAvailabilityProvider = Provider.family<List<AssetModel>, String>((
  ref,
  availability,
) {
  final assets = ref.watch(assetsProvider);
  return assets.where((asset) => asset.availability == availability).toList();
});

final assetTypeCountProvider = Provider.family<int, String>((ref, assetType) {
  final assets = ref.watch(assetsProvider);
  return assets.where((a) => a.assetType == assetType).length;
});

final assetSummaryProvider = Provider.family<Map<String, int>, String>((
  ref,
  tenantId,
) {
  final assets = ref.watch(tenantFilteredAssetsProvider(tenantId));
  final summary = <String, int>{};
  for (final asset in assets) {
    summary[asset.assetType] = (summary[asset.assetType] ?? 0) + 1;
  }
  return summary;
});

// Total count of all assets
final totalAssetsCountProvider = Provider<int>((ref) {
  final assets = ref.watch(assetsProvider);
  return assets.length;
});

// Total assets by tenant
final tenantAssetsCountProvider = Provider.family<int, String>((ref, tenantId) {
  final assets = ref.watch(tenantFilteredAssetsProvider(tenantId));
  return assets.length;
});

// Asset count by type
final assetCountByTypeProvider = Provider.family<int, String>((ref, assetType) {
  final assets = ref.watch(assetsByTypeProvider(assetType));
  return assets.length;
});

// Asset count by availability
final assetCountByAvailabilityProvider = Provider.family<int, String>((
  ref,
  availability,
) {
  final assets = ref.watch(assetsByAvailabilityProvider(availability));
  return assets.length;
});

// Availability summary
final availabilitySummaryProvider = Provider.family<Map<String, int>, String>((
  ref,
  tenantId,
) {
  final assets = ref.watch(tenantFilteredAssetsProvider(tenantId));
  final summary = <String, int>{};

  for (final asset in assets) {
    summary[asset.availability] = (summary[asset.availability] ?? 0) + 1;
  }

  return summary;
});

// Condition summary
final conditionSummaryProvider = Provider.family<Map<String, int>, String>((
  ref,
  tenantId,
) {
  final assets = ref.watch(tenantFilteredAssetsProvider(tenantId));
  final summary = <String, int>{};

  for (final asset in assets) {
    summary[asset.assetCondition] = (summary[asset.assetCondition] ?? 0) + 1;
  }

  return summary;
});

// Provider to search assets
final searchAssetsProvider = Provider.family<List<AssetModel>, String>((
  ref,
  query,
) {
  final assets = ref.watch(assetsProvider);
  final lowerQuery = query.toLowerCase();
  return assets
      .where(
        (asset) =>
            asset.assetName.toLowerCase().contains(lowerQuery) ||
            asset.serialNumber.toLowerCase().contains(lowerQuery),
      )
      .toList();
});
