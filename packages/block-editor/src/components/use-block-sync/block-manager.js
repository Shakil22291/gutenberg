/**
 * External dependencies
 */
import { v4 as uuid } from 'uuid';

/**
 * WordPress dependencies
 */
import { useState, useEffect, useRef } from '@wordpress/element';

const DIRECTION_IN = 'in';
const DIRECTION_OUT = 'out';
function flipDirection( direction ) {
	return direction === DIRECTION_IN ? DIRECTION_OUT : DIRECTION_IN;
}

function createBlockClientIdManager( shouldMapBlocks ) {
	const clientIdMap = { [ DIRECTION_IN ]: {}, [ DIRECTION_OUT ]: {} };

	const mapBlocks = ( blocks, direction ) => {
		if ( ! Array.isArray( blocks ) || ! shouldMapBlocks ) {
			return blocks;
		}

		return blocks.map( ( block ) => ( {
			...block,
			innerBlocks: mapBlocks( block.innerBlocks, direction ),
			clientId: mapBlockId( block.clientId, direction ),
		} ) );
	};

	const mapBlockId = ( blockClientId, direction ) => {
		// Avoid running map code on non-string clientIds. There appear to be times
		// where this function can be called with `blockClientId = {}`
		if ( typeof blockClientId !== 'string' || ! shouldMapBlocks ) {
			return blockClientId;
		}

		if ( ! clientIdMap[ direction ][ blockClientId ] ) {
			const newId = uuid();
			clientIdMap[ direction ][ blockClientId ] = newId;
			clientIdMap[ flipDirection( direction ) ][ newId ] = blockClientId;
		}
		return clientIdMap[ direction ][ blockClientId ];
	};

	return {
		updateOutgoingBlocks: ( blocks ) => mapBlocks( blocks, DIRECTION_OUT ),
		updateIncomingBlocks: ( blocks ) => mapBlocks( blocks, DIRECTION_IN ),
		getOutgoingBlockId: ( blockId ) => mapBlockId( blockId, DIRECTION_OUT ),
		getIncomingBlockId: ( blockId ) => mapBlockId( blockId, DIRECTION_IN ),
	};
}

const _entityListenerReference = {};
function assocateWithEntity( entityId ) {
	if ( ! entityId ) {
		return false;
	}

	const hasExistingListener = !! _entityListenerReference[ entityId ];
	if ( ! hasExistingListener ) {
		_entityListenerReference[ entityId ] = true;
	}
	return hasExistingListener;
}

export default function useBlockManager( entityId ) {
	// TODO: useState vs useRef here? Unsure if a change in the manager should
	// re-run useBlockSync, or if pointing at the ref works fine.
	const [ manager, updateManager ] = useState(
		createBlockClientIdManager( assocateWithEntity( entityId ) )
	);

	const entityIdRef = useRef( entityId );

	// This side effect creates a new block client ID manager if and only if the
	// component starts using blocks from a new entity. Since consumers require
	// the manager before this effect would be run, we initalize the manager
	// above and then avoid initalizing a new one the first time the effect runs.
	useEffect( () => {
		if ( entityIdRef.current !== entityId ) {
			updateManager(
				createBlockClientIdManager( assocateWithEntity( entityId ) )
			);
			entityIdRef.current = entityId;
		}
	}, [ entityId ] );

	return manager;
}
