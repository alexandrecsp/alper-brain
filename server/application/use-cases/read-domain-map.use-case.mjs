import { domainMapOf } from '../services/domain-map.service.mjs'
import { findBrain } from '../services/find-brain.service.mjs'

// Reads the domain map of a listed brain, from its files as they are now.
export const readDomainMap = ({ brainList, brainFiles }) => (id) => {
  const { path: root } = findBrain(brainList, id)
  return domainMapOf(brainFiles.all(root).files)
}
