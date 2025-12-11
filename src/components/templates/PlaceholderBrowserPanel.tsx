/**
 * PlaceholderBrowserPanel - Drawer laterale con TreeView per navigare placeholder e snippet
 *
 * Features:
 * - TreeView con tutti i placeholder (nessun limite di 10)
 * - Ricerca in tempo reale
 * - Categorizzazione gerarchica
 * - Tooltip con descrizione ed esempi
 * - Click-to-insert
 * - Tabs: Browser | Snippet
 */

import { useState, useMemo } from 'react';
import {
  Drawer,
  Box,
  TextField,
  Typography,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
  IconButton,
  InputAdornment,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  TextFields as TextIcon,
  Numbers as NumberIcon,
  CheckBox as BooleanIcon,
  DataArray as ArrayIcon,
  DataObject as ObjectIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { ChevronRight, ExpandMore } from '@mui/icons-material';
import { DM329_PLACEHOLDERS } from '../../utils/templateDataSchema';
import { AVAILABLE_HELPERS } from '../../utils/templateHelpers';
import type { PlaceholderDefinition } from '../../types/template';
import { SnippetLibrary } from './SnippetLibrary';

interface PlaceholderBrowserPanelProps {
  open: boolean;
  onClose: () => void;
  onInsertPlaceholder: (path: string) => void;
  onOpenWizard?: (type: 'loop' | 'condition', placeholder?: PlaceholderDefinition) => void;
}

interface TreeNode {
  id: string;
  label: string;
  path: string;
  type: string;
  description?: string;
  example?: any;
  children?: TreeNode[];
  isArray?: boolean;
  isHelper?: boolean;
}

const DRAWER_WIDTH = 320;

export function PlaceholderBrowserPanel({
  open,
  onClose,
  onInsertPlaceholder,
  onOpenWizard
}: PlaceholderBrowserPanelProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);

  // Costruisce albero da DM329_PLACEHOLDERS
  const placeholderTree = useMemo(() => {
    const buildTree = (items: PlaceholderDefinition[]): TreeNode[] => {
      if (!items || items.length === 0) {
        return [];
      }

      return items.map((item) => {
        const node: TreeNode = {
          id: item.path,
          label: item.path.split('.').pop() || item.path,
          path: item.path,
          type: item.type,
          description: item.description,
          example: item.example,
          isArray: item.type.includes('array')
        };

        if (item.children && item.children.length > 0) {
          node.children = buildTree(item.children);
        }

        return node;
      });
    };

    return buildTree(DM329_PLACEHOLDERS);
  }, []);

  // Helper come TreeNode
  const helperTree = useMemo(() => {
    return AVAILABLE_HELPERS.map((helper) => ({
      id: `helper_${helper.name}`,
      label: helper.name,
      path: helper.usage,
      type: 'helper',
      description: helper.description,
      example: helper.example,
      isHelper: true
    }));
  }, []);

  // Filtra albero in base alla ricerca
  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
    if (!query) return nodes;

    const lowerQuery = query.toLowerCase();
    const filtered: TreeNode[] = [];

    for (const node of nodes) {
      const matchesLabel = node.label.toLowerCase().includes(lowerQuery);
      const matchesPath = node.path.toLowerCase().includes(lowerQuery);
      const matchesDescription = node.description?.toLowerCase().includes(lowerQuery);

      const matches = matchesLabel || matchesPath || matchesDescription;

      if (node.children) {
        const filteredChildren = filterTree(node.children, query);
        if (filteredChildren.length > 0) {
          filtered.push({ ...node, children: filteredChildren });
        } else if (matches) {
          filtered.push({ ...node, children: [] });
        }
      } else if (matches) {
        filtered.push(node);
      }
    }

    return filtered;
  };

  const filteredPlaceholders = useMemo(
    () => filterTree(placeholderTree, searchQuery),
    [placeholderTree, searchQuery]
  );

  const filteredHelpers = useMemo(
    () => filterTree(helperTree, searchQuery),
    [helperTree, searchQuery]
  );

  // Espandi automaticamente risultati ricerca
  useMemo(() => {
    if (searchQuery) {
      const expandAll = (nodes: TreeNode[]): string[] => {
        const ids: string[] = [];
        nodes.forEach((node) => {
          ids.push(node.id);
          if (node.children) {
            ids.push(...expandAll(node.children));
          }
        });
        return ids;
      };
      setExpanded(expandAll(filteredPlaceholders));
    } else {
      setExpanded([]);
    }
  }, [searchQuery, filteredPlaceholders]);

  const handleInsert = (node: TreeNode) => {
    // Controlla se il path fa parte di un array (contiene [])
    const isPartOfArray = node.path.includes('[');

    if (node.isArray && onOpenWizard) {
      // Apri wizard per array (nodo root dell'array)
      const placeholder = findPlaceholderByPath(node.path);
      onOpenWizard('loop', placeholder);
    } else if (isPartOfArray && onOpenWizard) {
      // È un figlio di un array (es. apparecchiature[].codice)
      // Trova il placeholder dell'array genitore
      const arrayPath = node.path.split('[')[0]; // 'apparecchiature'
      const placeholder = findPlaceholderByPath(arrayPath);
      onOpenWizard('loop', placeholder);
    } else if (node.isHelper) {
      // Inserisci helper usage (già formattato)
      onInsertPlaceholder(node.path);
    } else {
      // Inserisci placeholder normale (aggiungi le graffe)
      onInsertPlaceholder(node.path);
    }
  };

  const findPlaceholderByPath = (path: string): PlaceholderDefinition | undefined => {
    const search = (items: PlaceholderDefinition[]): PlaceholderDefinition | undefined => {
      for (const item of items) {
        if (item.path === path) return item;
        if (item.children) {
          const found = search(item.children);
          if (found) return found;
        }
      }
    };
    return search(DM329_PLACEHOLDERS);
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('array')) return <ArrayIcon fontSize="small" />;
    if (type.includes('object')) return <ObjectIcon fontSize="small" />;
    if (type.includes('boolean')) return <BooleanIcon fontSize="small" />;
    if (type.includes('number')) return <NumberIcon fontSize="small" />;
    return <TextIcon fontSize="small" />;
  };

  const renderTree = (nodes: TreeNode[]) => {
    return nodes.map((node) => (
      <TreeItem
        key={node.id}
        itemId={node.id}
        label={
          <Tooltip
            title={
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                  {node.path}
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                  Tipo: {node.type}
                </Typography>
                {node.path.includes('[') && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'info.light' }}>
                    ⚡ Click per aprire wizard loop
                  </Typography>
                )}
                {node.description && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                    {node.description}
                  </Typography>
                )}
                {node.example && (
                  <Typography variant="caption" display="block" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                    Es: {JSON.stringify(node.example)}
                  </Typography>
                )}
              </Box>
            }
            placement="right"
            arrow
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                py: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleInsert(node);
              }}
            >
              {getTypeIcon(node.type)}
              <Typography variant="body2" sx={{ flex: 1 }}>
                {node.label}
              </Typography>
              {node.isArray && (
                <Chip label="array" size="small" color="primary" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
              {!node.isArray && node.path.includes('[') && (
                <Chip label="loop" size="small" color="info" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
              {node.isHelper && (
                <Chip label="fn" size="small" color="secondary" sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          </Tooltip>
        }
      >
        {node.children && renderTree(node.children)}
      </TreeItem>
    ));
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          mt: '64px', // Offset per app bar
          height: 'calc(100% - 64px)'
        }
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
            Placeholder Browser
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider />

        {/* Search */}
        <Box sx={{ p: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Cerca placeholder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab label="Browser" sx={{ minHeight: 40, fontSize: '0.875rem' }} />
          <Tab label="Snippet" sx={{ minHeight: 40, fontSize: '0.875rem' }} />
        </Tabs>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: activeTab === 0 ? 2 : 0 }}>
          {activeTab === 0 && (
            <>
              {/* Placeholder Section */}
              {filteredPlaceholders.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'primary.main' }}>
                    Placeholder ({filteredPlaceholders.length})
                  </Typography>
                  <SimpleTreeView
                    slots={{
                      collapseIcon: ExpandMore,
                      expandIcon: ChevronRight
                    }}
                    expandedItems={expanded}
                    onExpandedItemsChange={(_, nodeIds) => setExpanded(nodeIds)}
                    sx={{
                      '& .MuiTreeItem-content': {
                        borderRadius: 1,
                        my: 0.25
                      },
                      '& .MuiTreeItem-label': {
                        fontSize: '0.875rem'
                      }
                    }}
                  >
                    {renderTree(filteredPlaceholders)}
                  </SimpleTreeView>
                </Box>
              )}

              {/* Helper Section */}
              {filteredHelpers.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: 'secondary.main' }}>
                    Helper ({filteredHelpers.length})
                  </Typography>
                  <List dense>
                    {filteredHelpers.map((helper) => (
                      <ListItem key={helper.id} disablePadding>
                        <Tooltip
                          title={
                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                                {helper.path}
                              </Typography>
                              <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                {helper.description}
                              </Typography>
                            </Box>
                          }
                          placement="right"
                          arrow
                        >
                          <ListItemButton onClick={() => handleInsert(helper)}>
                            <CodeIcon fontSize="small" sx={{ mr: 1 }} />
                            <ListItemText
                              primary={helper.label}
                              primaryTypographyProps={{
                                fontSize: '0.875rem',
                                fontFamily: 'monospace'
                              }}
                            />
                          </ListItemButton>
                        </Tooltip>
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {/* No Results */}
              {filteredPlaceholders.length === 0 && filteredHelpers.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nessun risultato trovato
                  </Typography>
                </Box>
              )}
            </>
          )}

          {activeTab === 1 && (
            <SnippetLibrary onInsert={onInsertPlaceholder} />
          )}
        </Box>

        {/* Footer Info */}
        <Divider />
        <Box sx={{ p: 1.5, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" display="block">
            💡 Click su item per inserire
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            🔄 Badge "array" o "loop" apre wizard
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}
