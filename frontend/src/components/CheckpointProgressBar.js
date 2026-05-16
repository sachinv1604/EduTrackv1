import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { COLORS } from '../theme/colors';

const { width } = Dimensions.get('window');

const CheckpointProgressBar = ({ checkpoints, currentCheckpointIndex, arrivedAtCheckpoint, nextCheckpointETA, isActive }) => {
  if (!checkpoints || checkpoints.length === 0) return null;

  return (
    <View style={styles.container}>
      {checkpoints.map((checkpoint, index) => {
        const isPassed = index < currentCheckpointIndex;
        const isCurrent = index === currentCheckpointIndex;
        
        let status = 'upcoming';
        if (isPassed) status = 'passed';
        else if (isCurrent) status = arrivedAtCheckpoint ? 'at' : 'heading';

        const isLastStop = index === checkpoints.length - 1;
        const isTripDone = isLastStop && (status === 'at' || (isPassed && !isActive));

        return (
          <View key={index} style={styles.checkpointWrapper}>
            <View style={styles.row}>
              {/* Dot and Line */}
              <View style={styles.visualContainer}>
                <View 
                  style={[
                    styles.dot, 
                    status === 'passed' && styles.dotPassed,
                    status === 'at' && styles.dotAt,
                    status === 'heading' && styles.dotHeading
                  ]} 
                />
                {index < checkpoints.length - 1 && (
                  <View 
                    style={[
                      styles.line, 
                      status === 'passed' && styles.linePassed
                    ]} 
                  />
                )}
              </View>

              {/* Label */}
              <View style={styles.labelContainer}>
                <Text 
                  style={[
                    styles.name, 
                    (status === 'at' || status === 'heading') && styles.nameActive,
                    status === 'passed' && styles.namePassed
                  ]}
                  numberOfLines={1}
                >
                  {checkpoint.name}
                </Text>
                <Text style={styles.statusText}>
                  {isTripDone ? 'Destination Reached' : 
                   status === 'passed' ? 'Passed' : 
                   status === 'at' ? 'Bus is here' : 
                   status === 'heading' ? `Next stop ${nextCheckpointETA ? `(${nextCheckpointETA} mins)` : ''}` : 'Upcoming'}
                </Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  checkpointWrapper: {
    marginBottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  visualContainer: {
    alignItems: 'center',
    width: 30,
    marginRight: 15,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dotPassed: {
    backgroundColor: COLORS.secondary,
  },
  dotAt: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  dotHeading: {
    backgroundColor: 'transparent',
    borderColor: COLORS.secondary,
    borderWidth: 2,
  },
  line: {
    width: 2,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: -2,
    zIndex: 1,
  },
  linePassed: {
    backgroundColor: COLORS.secondary,
  },
  labelContainer: {
    flex: 1,
    paddingBottom: 25,
  },
  name: {
    color: COLORS.textDim,
    fontSize: 16,
    fontWeight: '600',
  },
  nameActive: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  namePassed: {
    color: COLORS.textDim,
  },
  statusText: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 2,
  },
});

export default CheckpointProgressBar;
